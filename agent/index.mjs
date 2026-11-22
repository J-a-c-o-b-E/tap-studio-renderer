// TAP Studio Agent: takes one job (schemas/job.schema.json), lets Claude plan and make the video with the
// tools in agent/tools, then checks, uploads and reports it (schemas/result.schema.json).
// The agent is a separate entry point from the renderer's HTTP server: it calls the renderer as a tool.
import { query } from "@anthropic-ai/claude-agent-sdk";
import Ajv from "ajv";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { BudgetError, Ledger, putFile, readJson, ROOT, sendWebhook } from "./lib.mjs";
import { createTapTools, TOOL_NAMES } from "./tools/index.mjs";

export const DEFAULT_MODEL = "claude-fable-5-2";
const FORMAT_SKILL = { motion_vsl: "motion-vsl", reaction_showcase: "reaction-showcase", song_ad: "song-ad" };

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true, strict: false });
let validators;
const schemas = () => (validators ??= { job: ajv.compile(readJson(path.join(ROOT, "schemas/job.schema.json"))), result: ajv.compile(readJson(path.join(ROOT, "schemas/result.schema.json"))) });

export const validateJob = (job) => {
  const v = schemas().job;
  return v(job) ? [] : v.errors.map((e) => `${e.instancePath.replace(/^\//, "").replace(/\//g, ".") || "job"}: ${e.message}${e.params?.additionalProperty ? ` "${e.params.additionalProperty}"` : ""}`);
};
export const validateResult = (result) => {
  const v = schemas().result;
  return v(result) ? [] : v.errors.map((e) => `${e.instancePath || "result"}: ${e.message}`);
};

const jobPrompt = (job, workDir) => `Make one video for this job.

<job>
${JSON.stringify({ ...job, output: undefined, webhooks: undefined }, null, 2)}
</job>

Work folder (every file you make goes here; pass file names relative to it to the tools): ${workDir}
Renderer scene reference: ${path.join(ROOT, "docs/scenes.md")}
Example plans that render correctly: ${path.join(ROOT, "examples")}/*.plan.json

Start by loading the skill for this format (\`${FORMAT_SKILL[job.format]}\`) and the \`safety\` skill, then follow them. The VidLab budget for this job is $${job.budget.max_usd.toFixed(2)}: check \`budget\` before paid steps. Finish by calling \`finish\` with the final MP4.`;

/**
 * Run one job to the end. Never throws for a job-level failure: it returns a result with status "failed".
 * @param job   the job (validated here)
 * @param opts  { runId, keepWorkDir, onEvent(event), signal }
 */
export const runJob = async (job, opts = {}) => {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const hooks = job?.webhooks ?? {};
  const secret = hooks.secret ?? process.env.WEBHOOK_HMAC_SECRET ?? process.env.WEBHOOK_SECRET ?? "";
  const ledger = new Ledger(job?.budget?.max_usd ?? 0);
  const model = process.env.AGENT_MODEL || DEFAULT_MODEL;
  const agentStats = { model, turns: 0, usd: 0 };
  let lastProgress = 0;

  const emit = (stage, message, force = false) => {
    const event = { event: "job.progress", job_id: job?.job_id ?? null, run_id: opts.runId ?? null, stage, message, spent_usd: ledger.spent, at: new Date().toISOString() };
    opts.onEvent?.(event);
    // progress webhooks are throttled to one every 3 seconds; stage changes always go out
    if (hooks.progress_url && (force || Date.now() - lastProgress > 3000)) {
      lastProgress = Date.now();
      sendWebhook(hooks.progress_url, secret, event, { retries: 1 });
    }
  };

  const finishResult = async (partial) => {
    const result = {
      event: "job.result",
      job_id: String(job?.job_id ?? "unknown"),
      run_id: opts.runId ?? null,
      format: job?.format ?? "motion_vsl",
      video_url: null,
      thumbnail_url: null,
      video: null,
      title: null,
      summary: null,
      script: null,
      safety: null,
      ...partial,
      cost: { vidlab_usd: ledger.spent, agent_usd: Math.round(agentStats.usd * 10000) / 10000, total_usd: Math.round((ledger.spent + agentStats.usd) * 10000) / 10000, items: ledger.items },
      agent: { model, turns: agentStats.turns, seconds: Math.round((Date.now() - t0) / 100) / 10 },
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      metadata: job?.metadata ?? null,
    };
    const problems = validateResult(result);
    if (problems.length) console.error(`result does not match result.schema.json: ${problems.join("; ")}`);
    opts.onEvent?.(result);
    if (hooks.result_url) await sendWebhook(hooks.result_url, secret, result);
    return result;
  };
  const failed = (code, message) => finishResult({ status: "failed", error: { code, message } });

  const problems = validateJob(job);
  if (problems.length) return failed("invalid_job", problems.join("; "));
  for (const name of ["ANTHROPIC_API_KEY", "VIDLAB_API_KEY"]) {
    // a motion_vsl still needs VidLab for the voiceover
    if (!process.env[name] && !(name === "ANTHROPIC_API_KEY" && process.env.CLAUDE_CODE_OAUTH_TOKEN)) return failed("missing_env", `${name} is not set`);
  }

  const workBase = process.env.AGENT_WORK_DIR || os.tmpdir();
  mkdirSync(workBase, { recursive: true });
  const workDir = mkdtempSync(path.join(workBase, `tap-job-${job.job_id}-`));
  const ctx = { job, workDir, ledger, progress: (stage, message) => emit(stage, message), state: { renders: [], finish: null } };

  try {
    emit("started", `${job.format} for ${job.product.name}`, true);
    const instructions = readFileSync(path.join(ROOT, "agent/CLAUDE.md"), "utf8");
    const abort = new AbortController();
    opts.signal?.addEventListener("abort", () => abort.abort());
    let agentError = null;
    const stream = query({
      prompt: jobPrompt(job, workDir),
      options: {
        model,
        cwd: ROOT, // so the project skills in .claude/skills are found
        additionalDirectories: [workDir],
        abortController: abort,
        systemPrompt: { type: "preset", preset: "claude_code", append: instructions },
        settingSources: ["project"],
        skills: ["vidlab", "motion-vsl", "reaction-showcase", "song-ad", "editing", "novelty", "safety"],
        mcpServers: { tap: createTapTools(ctx) },
        // read-only built-ins; every write goes through the write_file tool, which is confined to the work folder
        allowedTools: ["Read", "Glob", "Grep", ...TOOL_NAMES.map((n) => `mcp__tap__${n}`)],
        disallowedTools: ["Bash", "Write", "Edit", "WebFetch", "WebSearch", "Task", "Agent", "NotebookEdit"],
        permissionMode: "default",
        maxTurns: job.budget.max_turns ?? 60,
        maxBudgetUsd: job.budget.max_agent_usd ?? 3,
        env: { ...process.env, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1" },
      },
    });
    for await (const msg of stream) {
      if (msg.type === "assistant") {
        for (const block of msg.message?.content ?? []) {
          if (block.type === "tool_use") emit("working", String(block.name).replace(/^mcp__tap__/, ""));
        }
      } else if (msg.type === "result") {
        agentStats.turns = msg.num_turns ?? 0;
        agentStats.usd = msg.total_cost_usd ?? 0;
        if (msg.subtype !== "success" || msg.is_error) agentError = { code: `agent_${msg.subtype}`, message: msg.subtype === "success" ? String(msg.result).slice(0, 500) : `the agent stopped early (${msg.subtype})` };
      }
      if (ctx.state.finish) {
        // the video is accepted: no need to pay for a closing message
        abort.abort();
        break;
      }
    }

    const done = ctx.state.finish;
    if (!done) return failed(agentError?.code ?? "no_video", agentError?.message ?? "the agent ended without handing in a video");

    const out = job.output;
    const thumb = done.file.replace(/\.mp4$/i, ".jpg");
    const upload = opts.upload !== false; // local test runs can skip the upload
    if (upload) {
      emit("uploading", "video", true);
      await putFile(done.file, out.upload_url, out.upload_headers ?? {});
    }
    let thumbnailUrl = null;
    if (upload && out.thumbnail_upload_url && existsSync(thumb)) {
      await putFile(thumb, out.thumbnail_upload_url, out.upload_headers ?? {});
      thumbnailUrl = out.thumbnail_public_url ?? out.thumbnail_upload_url.split("?")[0];
    }
    const render = ctx.state.renders.find((r) => r.out === done.file);
    let loudness = null;
    try {
      const { measureLoudness } = await import(path.join(ROOT, "lib/pipeline.mjs"));
      loudness = (await measureLoudness(done.file)).lufs;
    } catch {
      /* reported as null */
    }
    if (opts.keepDir) {
      const { copyFileSync } = await import("node:fs");
      mkdirSync(opts.keepDir, { recursive: true });
      copyFileSync(done.file, path.join(opts.keepDir, `${job.job_id}.mp4`));
      if (existsSync(thumb)) copyFileSync(thumb, path.join(opts.keepDir, `${job.job_id}.jpg`));
      if (render) copyFileSync(render.plan, path.join(opts.keepDir, `${job.job_id}.plan.json`));
    }
    return finishResult({
      status: "succeeded",
      video_url: upload ? (out.public_url ?? out.upload_url.split("?")[0]) : null,
      thumbnail_url: thumbnailUrl,
      video: { duration_s: done.info.duration_s, width: done.info.video.width, height: done.info.video.height, fps: done.info.video.fps, bytes: done.info.bytes, loudness_lufs: Number.isFinite(loudness) ? loudness : null },
      title: done.title,
      summary: done.summary,
      script: done.script,
      safety: { mode: job.compliance ?? "meta_safe", passed: true, findings: [] },
      error: null,
    });
  } catch (e) {
    return failed(e instanceof BudgetError ? "budget_exceeded" : (e.code ?? "internal_error"), String(e.message).slice(0, 1000));
  } finally {
    if (!process.env.AGENT_KEEP_WORK_DIR) rmSync(workDir, { recursive: true, force: true });
  }
};
