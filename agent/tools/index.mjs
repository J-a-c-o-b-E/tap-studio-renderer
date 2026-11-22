// The agent's tools, served to Claude as one in-process MCP server ("tap").
// Every paid tool goes through the job's budget ledger; every file stays inside the job's work folder.
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { download, ffmpeg, generate, probe, readJson, ROOT, run, safetyScan, stringsOf, vidlab, vidlabUpload } from "../lib.mjs";

const ok = (data) => ({ content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 1) }] });
const fail = (e) => ({ content: [{ type: "text", text: `ERROR${e.code ? ` (${e.code})` : ""}: ${e.message}` }], isError: true });
const guard = (fn) => async (args) => {
  try {
    return ok(await fn(args));
  } catch (e) {
    return fail(e);
  }
};

export const TOOL_NAMES = ["write_file", "budget", "vidlab_model", "vidlab_generate", "vidlab_song_ad", "make_voiceover", "media_info", "frames", "validate_plan", "render_plan", "safety_check", "finish"];

/**
 * @param ctx { job, workDir, ledger, progress(stage, message), state }  state.finish is set by the `finish` tool
 */
export const createTapTools = (ctx) => {
  const { job, workDir, ledger } = ctx;
  /** Resolve a path inside the work folder (the agent may pass a bare name or an absolute path). */
  const inWork = (p) => {
    const abs = path.resolve(workDir, p);
    if (abs !== workDir && !abs.startsWith(workDir + path.sep)) throw new Error(`"${p}" is outside the job's work folder`);
    return abs;
  };
  const price = job.product?.price;
  const mode = job.compliance ?? "meta_safe";

  const loadPlan = (planPath) => {
    const file = inWork(planPath);
    const plan = readJson(file);
    // word timings and the voiceover file come from make_voiceover, so the agent never has to copy them
    const vo = path.join(workDir, "voiceover.json");
    if (!plan.words && plan.voiceover_url && existsSync(vo)) plan.words = readJson(vo).words;
    return { file, plan };
  };

  const tools = [
    tool(
      "write_file",
      "Write a text file (a plan, a script, notes) into the job's work folder, replacing it if it exists. This is the only way to write files.",
      { name: z.string().describe("File name inside the work folder, for example plan.json"), content: z.string() },
      guard(async ({ name, content }) => {
        const file = inWork(name);
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, content);
        return `wrote ${name} (${content.length} characters)`;
      }),
    ),

    tool("budget", "What this job may still spend on VidLab generations.", {}, guard(async () => ledger.status())),

    tool(
      "vidlab_model",
      "Read one VidLab model: the input fields it takes, their allowed values, and its prices. Free. Call it before the first vidlab_generate with a model.",
      { model: z.string().describe("Model id, for example ugc-image-1, seedance-2.5, minimax-speech-2.8") },
      guard(async ({ model }) => {
        const m = await vidlab("GET", `/models/${encodeURIComponent(model)}`, { auth: false });
        return { id: m.id, kind: m.kind, unit: m.unit, prices: m.prices, status: m.status, description: m.description, params: m.params, limits: m.limits ?? null };
      }),
    ),

    tool(
      "vidlab_generate",
      "Run one VidLab model (an image or a video) and download the result into the work folder. Priced first and refused if it would pass the job's budget. A failed generation costs nothing. To pass a local file from the work folder as an input (for example the start frame for image-to-video), list it in `local_files` and it is uploaded and added to the input for you.",
      {
        model: z.string(),
        input: z.record(z.string(), z.any()).describe("The model's input fields, exactly as vidlab_model lists them"),
        save_as: z.string().describe("File name for the result in the work folder, for example reaction.mp4 or start.png"),
        label: z.string().describe("Short label for the cost report, for example \"reaction clip\""),
        local_files: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional().describe("Input field -> local file name(s) to upload, for example {\"images\": [\"start.png\"]}"),
      },
      guard(async ({ model, input, save_as, label, local_files }) => {
        const full = { ...input };
        for (const [field, files] of Object.entries(local_files ?? {})) {
          const urls = [];
          for (const f of Array.isArray(files) ? files : [files]) urls.push(await vidlabUpload(inWork(f)));
          full[field] = Array.isArray(files) ? urls : urls[0];
        }
        ctx.progress("generating", label);
        const out = await generate(ledger, { model, input: full, label, file: inWork(save_as) });
        const info = await probe(out.file).catch(() => null);
        return { file: save_as, cost_usd: out.usd, generation: out.id, media: info, budget_remaining_usd: ledger.remaining };
      }),
    ),

    tool(
      "vidlab_song_ad",
      "Run VidLab's Song Ad system (an original song sung by an animated character) in pipeline mode and download the finished video into the work folder. It bills as it goes and names no price, so the remaining budget is sent as its spending limit and the real cost is read from the balance afterwards. Takes several minutes.",
      {
        prompt: z.string().describe("What to make, in plain words: the product, the idea of the song, the tone"),
        brief: z.string().optional(),
        lyrics: z.string().optional().describe("Optional. Your own lyrics, used word for word"),
        save_as: z.string().default("song.mp4"),
      },
      guard(async ({ prompt, brief, lyrics, save_as }) => {
        const limit = ledger.remaining;
        if (limit < 1) throw Object.assign(new Error(`only $${limit.toFixed(2)} of budget is left: too little to start a song ad`), { code: "budget_exceeded" });
        const release = ledger.hold(limit, "song ad");
        const before = await vidlab("GET", "/balance");
        let runState;
        try {
          const inputs = { product_name: job.product.name, aspect_ratio: "9:16", ...(brief ? { brief } : {}), ...(lyrics ? { script: lyrics } : {}), ...(job.product.image_urls?.length ? { images: job.product.image_urls } : {}) };
          runState = await vidlab("POST", "/system-runs", { body: { system: "song-ad", prompt, mode: "pipeline", checkpoints: "none", max_price_usd: limit, inputs } });
          ctx.progress("generating", "song ad");
          const started = Date.now();
          while (!["succeeded", "failed", "cancelled"].includes(runState.status)) {
            if (runState.status === "needs_input" || runState.status === "needs_approval") {
              await vidlab("POST", `/system-runs/${runState.run_id}/cancel`).catch(() => {});
              throw Object.assign(new Error(`the song ad stopped for a decision (${runState.error?.code ?? runState.waiting_for ?? runState.status}): ${runState.message ?? "it would pass the spending limit or needs more credit"}. It was cancelled; what it had already spent is not refunded.`), { code: runState.error?.code ?? "system_run_stopped" });
            }
            if (Date.now() - started > 45 * 60000) {
              await vidlab("POST", `/system-runs/${runState.run_id}/cancel`).catch(() => {});
              throw new Error("the song ad did not finish within 45 minutes and was cancelled");
            }
            await new Promise((r) => setTimeout(r, 10000));
            runState = await vidlab("GET", `/system-runs/${runState.run_id}`);
          }
          if (runState.status !== "succeeded") throw Object.assign(new Error(`song ad ${runState.status}: ${runState.error?.message ?? runState.message ?? ""}`), { code: runState.error?.code ?? "system_run_failed" });
          const url = runState.output?.videos?.[0]?.url;
          if (!url) throw new Error("the song ad finished without a video");
          await download(url, inWork(save_as));
        } finally {
          release();
          const after = await vidlab("GET", "/balance").catch(() => null);
          // the balance is shared by the whole account, so this is exact only when nothing else is spending at the same time
          const cost = after ? Math.max(0, (before.available_cents + (before.held_cents ?? 0) - after.available_cents - (after.held_cents ?? 0)) / 100) : 0;
          if (cost > 0) ledger.add("song ad (system run, from balance)", "song-ad", cost);
        }
        return { file: save_as, run_id: runState.run_id, lyrics_or_text: runState.output?.text ?? null, media: await probe(inWork(save_as)), budget_remaining_usd: ledger.remaining };
      }),
    ),

    tool(
      "make_voiceover",
      "Make the voiceover and its word timings. Each line is spoken as its own clip (minimax-speech-2.8), trimmed and joined, so line starts are exact and words inside a line are spread by length. Writes voiceover.mp3 and voiceover.json (lines and words with start/end in seconds) into the work folder. Write numbers the way they are said in `text` (\"five dollars\") and the way they are shown in `caption` (\"$5\").",
      {
        lines: z.array(z.object({ text: z.string().describe("What is said"), caption: z.string().optional().describe("What the caption shows, if different"), pause_after: z.number().optional().describe("Seconds of silence after this line (default 0.12)") })).min(1).max(60),
        offset_s: z.number().optional().describe("Seconds of silence before the first line, for example when a reaction clip plays first"),
      },
      guard(async ({ lines, offset_s = 0 }) => {
        const voice = job.voice?.voice_id ?? "English_expressive_narrator";
        const speed = job.voice?.speed ?? 1.05;
        const dir = inWork("vo");
        mkdirSync(dir, { recursive: true });
        ctx.progress("voiceover", `${lines.length} lines`);
        // the lines are generated four at a time: one after another they would take longer than a tool call may run
        for (let i = 0; i < lines.length; i += 4) {
          await Promise.all(lines.slice(i, i + 4).map((l, k) => generate(ledger, { model: "minimax-speech-2.8", input: { text: l.text, voice, quality: "turbo", extra: { speed } }, label: `voiceover line ${i + k + 1}`, file: path.join(dir, `${i + k}.mp3`) })));
        }
        const parts = [];
        let t = offset_s;
        const words = [];
        const outLines = [];
        for (let i = 0; i < lines.length; i++) {
          const raw = path.join(dir, `${i}.mp3`);
          const wav = path.join(dir, `${i}.wav`);
          // trim the silence at both ends so cuts land on the words
          await ffmpeg(["-i", raw, "-af", "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse", "-ar", "48000", "-ac", "1", wav]);
          const dur = (await probe(wav)).duration_s;
          const toks = (lines[i].caption ?? lines[i].text).split(/\s+/).filter(Boolean);
          const weight = (w) => Math.max(2, w.replace(/[^\p{L}\p{N}]/gu, "").length) + (/[.,!?;:]$/.test(w) ? 2 : 0);
          const total = toks.reduce((n, w) => n + weight(w), 0);
          let c = t;
          for (const w of toks) {
            const d = (weight(w) / total) * dur;
            words.push({ text: w, start: Math.round(c * 1000) / 1000, end: Math.round((c + d * 0.94) * 1000) / 1000 });
            c += d;
          }
          outLines.push({ index: i, text: lines[i].caption ?? lines[i].text, start: Math.round(t * 1000) / 1000, end: Math.round((t + dur) * 1000) / 1000 });
          parts.push({ wav, gap: lines[i].pause_after ?? 0.12 });
          t += dur + (lines[i].pause_after ?? 0.12);
        }
        const list = path.join(dir, "list.txt");
        const sil = (s, n) => path.join(dir, `sil_${n}.wav`);
        const entries = [];
        if (offset_s > 0) {
          await ffmpeg(["-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", String(offset_s), sil(offset_s, "head")]);
          entries.push(sil(offset_s, "head"));
        }
        for (let i = 0; i < parts.length; i++) {
          entries.push(parts[i].wav);
          if (i < parts.length - 1 && parts[i].gap > 0) {
            await ffmpeg(["-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", String(parts[i].gap), sil(parts[i].gap, i)]);
            entries.push(sil(parts[i].gap, i));
          }
        }
        writeFileSync(list, entries.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
        await ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c:a", "libmp3lame", "-b:a", "160k", inWork("voiceover.mp3")]);
        const duration = (await probe(inWork("voiceover.mp3"))).duration_s;
        writeFileSync(inWork("voiceover.json"), JSON.stringify({ duration_s: duration, lines: outLines, words }, null, 1));
        return { voiceover: "voiceover.mp3", duration_s: duration, lines: outLines, word_count: words.length, note: "Set \"voiceover_url\": \"voiceover.mp3\" in the plan and leave out \"words\": render_plan fills them in from voiceover.json. Cut scenes on the line start times.", budget_remaining_usd: ledger.remaining };
      }),
    ),

    tool("media_info", "Duration, size, resolution and codecs of a file in the work folder.", { file: z.string() }, guard(async ({ file }) => probe(inWork(file)))),

    tool(
      "frames",
      "Save still frames of a video in the work folder as JPEGs so you can look at them with Read (a start frame, a reaction clip, or the finished video for a visual check).",
      { file: z.string(), times_s: z.array(z.number()).min(1).max(12), prefix: z.string().default("frame") },
      guard(async ({ file, times_s, prefix }) => {
        const out = [];
        for (const t of times_s) {
          const f = inWork(`${prefix}_${String(t).replace(".", "_")}.jpg`);
          await ffmpeg(["-ss", String(t), "-i", inWork(file), "-frames:v", "1", "-vf", "scale=540:-2", "-q:v", "4", f]);
          out.push(f);
        }
        return { files: out, note: "Open them with the Read tool." };
      }),
    ),

    tool(
      "validate_plan",
      "Check a renderer plan (JSON file in the work folder) against the plan schema and the safety rules, without rendering. Free and fast: use it before every render.",
      { plan: z.string().describe("Plan file name, for example plan.json") },
      guard(async ({ plan: planPath }) => {
        const { plan } = loadPlan(planPath);
        const tmp = inWork(".validate.json");
        writeFileSync(tmp, JSON.stringify(plan));
        let schema = "OK";
        try {
          schema = (await run(process.execPath, [path.join(ROOT, "bin/render.mjs"), "--validate-only", tmp], { cwd: ROOT, timeoutMs: 60000 })).out.trim();
        } catch (e) {
          schema = (e.err || e.message).trim();
        }
        const safety = safetyScan(stringsOf({ scenes: plan.scenes, words: (plan.words ?? []).map((w) => w.text) }), { mode, price });
        const dur = plan.duration ?? null;
        return { schema, safety_findings: safety, scenes: plan.scenes?.length ?? 0, words: plan.words?.length ?? 0, duration_s: dur };
      }),
    ),

    tool(
      "render_plan",
      "Render a plan with the TAP renderer (`render --plan plan.json --out out.mp4`): 1080x1920, 30 fps, H.264 + AAC, about -14 LUFS, plus a thumbnail. Local files named in the plan (voiceover.mp3, a footage clip) are read from the work folder. Takes a few minutes per minute of video. The plan must pass validate_plan first.",
      { plan: z.string(), out: z.string().default("final.mp4") },
      guard(async ({ plan: planPath, out }) => {
        const { plan } = loadPlan(planPath);
        const safety = safetyScan(stringsOf({ scenes: plan.scenes, words: (plan.words ?? []).map((w) => w.text) }), { mode, price });
        if (safety.length) throw Object.assign(new Error(`the plan breaks the safety rules, fix it first:\n- ${safety.join("\n- ")}`), { code: "unsafe_plan" });
        delete plan.output;
        delete plan.webhook_url;
        const merged = inWork(`.render_${path.basename(planPath)}`);
        writeFileSync(merged, JSON.stringify(plan));
        ctx.progress("rendering", out);
        const { out: stdout } = await run(process.execPath, [path.join(ROOT, "bin/render.mjs"), "--plan", merged, "--out", inWork(out), "--no-upload", "--json"], { cwd: ROOT, timeoutMs: 40 * 60000 });
        const result = JSON.parse(stdout.slice(stdout.indexOf("{")));
        ctx.state.renders.push({ plan: merged, out: inWork(out) });
        return { file: out, thumbnail: path.basename(result.thumbnail), duration_s: result.duration, bytes: result.bytes, loudness_lufs: result.loudness?.lufs ?? null, render_seconds: result.render_seconds };
      }),
    ),

    tool(
      "safety_check",
      "Scan text (a script, lyrics, on-screen lines) against the job's safety rules. Returns the findings; an empty list means it passes.",
      { text: z.string() },
      guard(async ({ text }) => ({ mode, findings: safetyScan([text], { mode, price }) })),
    ),

    tool(
      "finish",
      "Hand in the finished video. Call it once, last, after you have rendered the final file with render_plan and looked at frames of it.",
      {
        video: z.string().describe("The final MP4 in the work folder (it must come from render_plan)"),
        title: z.string().describe("A short title for the video"),
        summary: z.string().describe("What you made and why, in two to four sentences"),
        script: z.string().describe("The words spoken or sung"),
      },
      guard(async ({ video, title, summary, script }) => {
        const file = inWork(video);
        if (!ctx.state.renders.some((r) => r.out === file)) throw new Error(`${video} was not made by render_plan in this job. The final file must come from the renderer.`);
        const info = await probe(file);
        if (!info.video || info.video.width !== 1080 || info.video.height !== 1920) throw new Error(`${video} is ${info.video?.width}x${info.video?.height}, not 1080x1920`);
        const findings = safetyScan([script, title], { mode, price });
        if (findings.length) throw Object.assign(new Error(`the script breaks the safety rules:\n- ${findings.join("\n- ")}`), { code: "unsafe_script" });
        ctx.state.finish = { file, title, summary, script, info };
        return "Accepted. Stop now: the harness uploads the video and reports the result.";
      }),
    ),
  ];

  return createSdkMcpServer({ name: "tap", version: "1.0.0", tools });
};

export const docsFor = () => readFileSync(path.join(ROOT, "docs/scenes.md"), "utf8");
