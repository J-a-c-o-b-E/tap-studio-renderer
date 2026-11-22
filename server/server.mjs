#!/usr/bin/env node
// HTTP render server.
//   POST /render          body: a video plan  -> 202 { job_id, status: "queued" }
//   GET  /jobs/:id        job status and result
//   GET  /jobs/:id/video  the MP4 (kept on disk for JOB_TTL_HOURS)
//   GET  /jobs/:id/thumbnail
//   GET  /health
// When a job ends, the plan's webhook_url is called with the result.
import { randomUUID } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { bundleProject, renderPlan, ROOT, validatePlan } from "../lib/pipeline.mjs";

const PORT = Number(process.env.PORT ?? 8080);
const TOKEN = process.env.API_TOKEN ?? "";
const WORKERS = Math.max(1, Number(process.env.MAX_PARALLEL_RENDERS ?? 1));
const JOBS_DIR = path.resolve(process.env.JOBS_DIR ?? path.join(ROOT, "jobs"));
const TTL_MS = Number(process.env.JOB_TTL_HOURS ?? 24) * 3600 * 1000;
const USE_LAMBDA = process.env.RENDER_MODE === "lambda";
const MAX_BODY = 5 * 1024 * 1024;
mkdirSync(JOBS_DIR, { recursive: true });

const jobs = new Map();
const queue = [];
let running = 0;

const publicJob = (j) => ({
  job_id: j.id,
  plan_id: j.plan.id ?? null,
  status: j.status,
  stage: j.stage,
  progress: j.progress,
  created_at: j.createdAt,
  finished_at: j.finishedAt ?? null,
  error: j.error ?? null,
  ...(j.result ? { video_url: j.result.video_url, thumbnail_url: j.result.thumbnail_url, duration: j.result.duration, width: j.result.width, height: j.result.height, bytes: j.result.bytes, loudness_lufs: j.result.loudness?.lufs ?? null, render_seconds: j.result.render_seconds } : {}),
});

const callWebhook = async (job) => {
  const url = job.plan.webhook_url;
  if (!url) return;
  const body = JSON.stringify(publicJob(job));
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "X-Tap-Job-Id": job.id }, body, signal: AbortSignal.timeout(15000) });
      if (res.ok) return;
      console.error(`[${job.id}] webhook attempt ${attempt}: HTTP ${res.status}`);
    } catch (e) {
      console.error(`[${job.id}] webhook attempt ${attempt}: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, attempt * 5000));
  }
};

const work = async () => {
  if (running >= WORKERS) return;
  const job = queue.shift();
  if (!job) return;
  running++;
  job.status = "rendering";
  const dir = path.join(JOBS_DIR, job.id);
  try {
    const opts = { out: path.join(dir, "video.mp4"), thumbnail: path.join(dir, "thumbnail.jpg"), onProgress: ({ stage, progress }) => Object.assign(job, { stage, progress: Math.round(progress * 100) / 100 }) };
    job.result = USE_LAMBDA ? await (await import("../lib/lambda.mjs")).renderPlanOnLambda(job.plan, opts) : await renderPlan(job.plan, opts);
    // with no upload target, the files are served by this server
    job.result.video_url ??= `${job.baseUrl}/jobs/${job.id}/video`;
    job.result.thumbnail_url ??= `${job.baseUrl}/jobs/${job.id}/thumbnail`;
    job.status = "done";
    console.log(`[${job.id}] done in ${job.result.render_seconds}s`);
  } catch (e) {
    job.status = "failed";
    job.error = e.message;
    console.error(`[${job.id}] failed: ${e.message}`);
  }
  job.finishedAt = new Date().toISOString();
  running--;
  callWebhook(job);
  work();
};

setInterval(() => {
  for (const [id, j] of jobs) {
    if (j.finishedAt && Date.now() - Date.parse(j.finishedAt) > TTL_MS) {
      rmSync(path.join(JOBS_DIR, id), { recursive: true, force: true });
      jobs.delete(id);
    }
  }
}, 600000).unref();

const send = (res, code, body) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};
const sendFile = (res, file, type) => {
  if (!existsSync(file)) return send(res, 404, { error: "not found" });
  res.writeHead(200, { "Content-Type": type, "Content-Length": statSync(file).size });
  createReadStream(file).pipe(res);
};
const readBody = (req) =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("body too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  const parts = url.pathname.split("/").filter(Boolean);
  if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true, queued: queue.length, rendering: running, mode: USE_LAMBDA ? "lambda" : "local" });
  if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) return send(res, 401, { error: "missing or wrong bearer token" });

  if (req.method === "POST" && url.pathname === "/render") {
    let plan;
    try {
      plan = JSON.parse(await readBody(req));
    } catch (e) {
      return send(res, 400, { error: `body is not valid JSON: ${e.message}` });
    }
    const problems = validatePlan(plan);
    if (problems.length) return send(res, 422, { error: "invalid plan", problems });
    const proto = req.headers["x-forwarded-proto"] ?? "http";
    const job = { id: randomUUID(), plan, status: "queued", stage: "queued", progress: 0, createdAt: new Date().toISOString(), baseUrl: process.env.PUBLIC_URL ?? `${proto}://${req.headers.host}` };
    jobs.set(job.id, job);
    queue.push(job);
    work();
    return send(res, 202, { job_id: job.id, status: job.status, status_url: `${job.baseUrl}/jobs/${job.id}` });
  }
  if (req.method === "GET" && parts[0] === "jobs" && parts[1]) {
    const job = jobs.get(parts[1]);
    if (!job) return send(res, 404, { error: "no such job" });
    if (!parts[2]) return send(res, 200, publicJob(job));
    if (parts[2] === "video") return sendFile(res, path.join(JOBS_DIR, job.id, "video.mp4"), "video/mp4");
    if (parts[2] === "thumbnail") return sendFile(res, path.join(JOBS_DIR, job.id, "thumbnail.jpg"), "image/jpeg");
  }
  send(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`tap-studio-renderer listening on :${PORT} (${USE_LAMBDA ? "lambda" : "local"} rendering, ${WORKERS} at a time${TOKEN ? ", bearer token required" : ", NO API_TOKEN set"})`);
  if (!USE_LAMBDA) bundleProject().catch((e) => console.error(`bundle failed: ${e.message}`)); // warm up
});
