// Shared plumbing for the TAP Studio Agent: paths, child processes, the VidLab client, the budget ledger,
// the safety scan, signed webhooks and uploads. No secrets are ever written to disk or logs.
import { spawn } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

/** Repo root: where bin/render.mjs, docs/ and .claude/skills live. In Trigger.dev that is the build directory (cwd). */
export const ROOT = (() => {
  for (const dir of [process.env.TAP_ROOT, process.cwd()].filter(Boolean)) if (existsSync(path.join(dir, "bin/render.mjs"))) return path.resolve(dir);
  throw new Error("TAP_ROOT is not set and the working directory is not the tap-studio-renderer folder (bin/render.mjs not found)");
})();

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";
const VIDLAB = "https://vidlab.ai/v1";

/* ------------------------------------------------------------------ processes */

export const run = (cmd, args, { cwd, timeoutMs = 600000, env } = {}) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, env: env ?? process.env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => p.kill("SIGKILL"), timeoutMs);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`${cmd} could not be started: ${e.message}`));
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve({ out, err }) : reject(Object.assign(new Error(`${path.basename(cmd)} exited with ${code}: ${(err || out).slice(-1500)}`), { out, err, code }));
    });
  });
export const ffmpeg = (args, opts) => run(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args], opts);

/** Duration, size and streams of a media file. */
export const probe = async (file) => {
  const { out } = await run(FFPROBE, ["-v", "error", "-show_entries", "format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate", "-of", "json", file]);
  const j = JSON.parse(out);
  const v = (j.streams ?? []).find((s) => s.codec_type === "video");
  const a = (j.streams ?? []).find((s) => s.codec_type === "audio");
  const [n, d] = (v?.r_frame_rate ?? "0/1").split("/").map(Number);
  return {
    duration_s: Math.round(Number(j.format?.duration ?? 0) * 1000) / 1000,
    bytes: Number(j.format?.size ?? statSync(file).size),
    video: v ? { codec: v.codec_name, width: v.width, height: v.height, fps: d ? Math.round((n / d) * 100) / 100 : 0 } : null,
    audio: a ? { codec: a.codec_name, sample_rate: Number(a.sample_rate) } : null,
  };
};

/* ------------------------------------------------------------------ budget ledger */

export class BudgetError extends Error {
  constructor(message) {
    super(message);
    this.code = "budget_exceeded";
  }
}

/** Tracks what VidLab calls cost against the job's cap. Money is held before a call and settled after it. */
export class Ledger {
  constructor(maxUsd) {
    this.max = maxUsd;
    this.items = [];
    this.held = 0;
  }
  get spent() {
    return Math.round(this.items.reduce((n, i) => n + i.usd, 0) * 10000) / 10000;
  }
  get remaining() {
    return Math.round((this.max - this.spent - this.held) * 10000) / 10000;
  }
  hold(usd, label) {
    if (usd > this.remaining + 1e-9) throw new BudgetError(`"${label}" would cost up to $${usd.toFixed(2)} but only $${this.remaining.toFixed(2)} of the $${this.max.toFixed(2)} budget is left. Use a cheaper setting or skip it.`);
    this.held += usd;
    return () => (this.held = Math.max(0, this.held - usd));
  }
  add(label, model, usd) {
    this.items.push({ label, model, usd: Math.round(usd * 10000) / 10000 });
  }
  status() {
    return { budget_usd: this.max, spent_usd: this.spent, remaining_usd: this.remaining, items: this.items };
  }
}

/* ------------------------------------------------------------------ VidLab */

const key = () => {
  const k = process.env.VIDLAB_API_KEY;
  if (!k) throw Object.assign(new Error("VIDLAB_API_KEY is not set"), { code: "missing_key" });
  return k;
};

export const vidlab = async (method, route, { body, auth = true, headers = {}, raw = false } = {}) => {
  const res = await fetch(route.startsWith("http") ? route : VIDLAB + route, {
    method,
    headers: { ...(auth ? { Authorization: `Bearer ${key()}` } : {}), ...(body && !raw ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body ? (raw ? body : JSON.stringify(body)) : undefined,
    ...(raw ? { duplex: "half" } : {}),
    signal: AbortSignal.timeout(120000),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  if (!res.ok) {
    const e = json?.error ?? {};
    throw Object.assign(new Error(`VidLab ${method} ${route}: ${res.status} ${e.code ?? ""} ${e.message ?? text.slice(0, 300)}`.trim()), { code: e.code ?? `http_${res.status}`, status: res.status });
  }
  return json?.data ?? json;
};

export const download = async (url, file, headers = {}) => {
  const res = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(300000) });
  if (!res.ok || !res.body) throw new Error(`download failed: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(file));
  return file;
};

const TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".mp4": "video/mp4", ".mov": "video/quicktime", ".mp3": "audio/mpeg", ".wav": "audio/wav" };
export const mimeOf = (file) => TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";

/** Upload a local file to VidLab so a model can read it. Returns its https URL. */
export const vidlabUpload = async (file) => {
  const d = await vidlab("POST", "/uploads", { body: createReadStream(file), raw: true, headers: { "Content-Type": mimeOf(file), "X-File-Name": path.basename(file), "Content-Length": String(statSync(file).size) } });
  return d.url;
};

/** One paid generation: price it, hold the money, run it, wait, download the first output, settle. */
export const generate = async (ledger, { model, input, label, file }) => {
  const est = await vidlab("POST", "/estimate", { body: { model, input }, auth: false });
  const cap = Number(est.up_to_usd ?? est.price_usd);
  const release = ledger.hold(cap, label);
  try {
    let gen = await vidlab("POST", "/generations", { body: { model, input, max_cost_usd: cap }, headers: { "Idempotency-Key": randomUUID() } });
    const started = Date.now();
    while (gen.status !== "succeeded" && gen.status !== "failed") {
      if (Date.now() - started > 25 * 60000) throw new Error(`${model}: still ${gen.status} after 25 minutes (generation ${gen.id})`);
      gen = await vidlab("GET", `/generations/${gen.id}?wait=60`);
    }
    if (gen.status === "failed") throw Object.assign(new Error(`${model} failed: ${gen.error?.message ?? "no reason given"} (not charged)`), { code: gen.error?.code ?? "generation_failed" });
    const url = gen.outputs?.[0]?.url;
    if (!url) throw new Error(`${model}: succeeded but returned no output`);
    await download(url, file);
    ledger.add(label, model, Number(gen.price_usd ?? cap));
    return { id: gen.id, file, url, usd: Number(gen.price_usd ?? cap), outputs: (gen.outputs ?? []).length };
  } finally {
    release();
  }
};

/* ------------------------------------------------------------------ safety */

const META_BANNED = [
  [/\b(make|making|earn|earning|earned)\s+(money|cash|income|\$)/i, "earnings language"],
  [/\bpassive income\b/i, "\"passive income\""],
  [/\b(get|become)\s+rich\b|\bfinancial freedom\b|\bquit your (job|9)/i, "wealth promise"],
  [/\bguarantee[ds]?\b/i, "guarantee"],
  [/\b(forex|trading|trader|signals?|crypto|bitcoin|investment|investing|invest|gold|profits?)\b/i, "finance / trading word"],
  [/\bintern\b/i, "\"intern\""],
  [/\bi need more (people|affiliates)\b|\bmore offers than (people|affiliates)\b/i, "recruiting language"],
  [/\bfirst \$?1,?000\b|\buntil you make\b/i, "earnings promise"],
];
const AMOUNT = /(?:[$£€]\s?\d[\d,.]*\s?[kKmM]?|\b\d[\d,.]*\s?(?:dollars|usd|pounds|euros)\b)/g;
const norm = (s) => s.replace(/[\s,]/g, "").replace(/\.$/, "").toLowerCase();

/** Every string in a value (a plan, a script, a list of words). */
export const stringsOf = (v, out = []) => {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => stringsOf(x, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (!/url$|^url$|^type$|^icon$|cover|^platform/i.test(k)) stringsOf(x, out);
  return out;
};

/** Meta-safe scan: banned wording and any amount other than the product's own price. Returns a list of findings. */
export const safetyScan = (texts, { mode = "meta_safe", price } = {}) => {
  if (mode !== "meta_safe") return [];
  const findings = new Set();
  const allowed = price ? norm(price) : null;
  // spoken words arrive one per string, so also scan them joined
  const joined = texts.join(" ");
  for (const t of [...texts, joined]) {
    for (const [re, why] of META_BANNED) {
      const m = re.exec(t);
      if (m) findings.add(`${why}: "${m[0]}"`);
    }
  }
  for (const m of joined.matchAll(AMOUNT)) if (!allowed || norm(m[0]) !== allowed) findings.add(`amount other than the price: "${m[0].trim()}"`);
  return [...findings];
};

/* ------------------------------------------------------------------ webhooks and uploads */

/** POST a JSON body signed with HMAC-SHA256 over `${timestamp}.${body}`. Never throws: a webhook must not fail a job. */
export const sendWebhook = async (url, secret, payload, { retries = 3 } = {}) => {
  if (!url) return false;
  const body = JSON.stringify(payload);
  for (let attempt = 1; attempt <= retries; attempt++) {
    const ts = String(Math.floor(Date.now() / 1000));
    const headers = { "Content-Type": "application/json", "User-Agent": "tap-studio-agent", "X-Tap-Event": payload.event ?? "", "X-Tap-Timestamp": ts };
    if (secret) headers["X-Tap-Signature"] = `sha256=${createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex")}`;
    try {
      const res = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(15000) });
      if (res.ok) return true;
    } catch {
      /* retried below */
    }
    if (attempt < retries) await new Promise((r) => setTimeout(r, attempt * 2000));
  }
  return false;
};

/** The AccessKey Bunny expects for a host, from the environment: Storage (storage.bunnycdn.com) or Stream (video.bunnycdn.com). */
const bunnyKey = (host) => {
  if (/(^|\.)video\.bunnycdn\.com$/i.test(host)) return process.env.BUNNY_STREAM_API_KEY;
  if (/(^|\.)bunnycdn\.com$/i.test(host)) return process.env.BUNNY_STORAGE_API_KEY;
  return undefined;
};

/** PUT a file to its upload URL. Bunny URLs get their AccessKey header from the environment unless the job gave one. */
export const putFile = async (file, url, headers = {}) => {
  const h = { "Content-Type": mimeOf(file), "Content-Length": String(statSync(file).size), ...headers };
  const key = bunnyKey(new URL(url).hostname);
  if (key && !Object.keys(h).some((k) => k.toLowerCase() === "accesskey")) h.AccessKey = key;
  const res = await fetch(url, { method: "PUT", headers: h, body: createReadStream(file), duplex: "half", signal: AbortSignal.timeout(600000) });
  if (!res.ok) throw Object.assign(new Error(`upload to ${new URL(url).hostname} failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`), { code: "upload_failed" });
};

export const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
