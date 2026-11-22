// The render pipeline: validate the plan -> render with Remotion -> normalise loudness -> thumbnail -> upload.
import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUILD_DIR = path.join(ROOT, "build");
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const isUrl = (s) => /^https?:\/\//.test(s);

/* ------------------------------------------------------------------ plan */

let validator;
/** Returns a list of readable problems (empty when the plan is valid). */
export const validatePlan = (plan) => {
  if (!validator) {
    const schema = JSON.parse(readFileSync(path.join(ROOT, "schema/plan.schema.json"), "utf8"));
    validator = new Ajv({ allErrors: true, allowUnionTypes: true, strict: false }).compile(schema);
  }
  if (validator(plan)) {
    const problems = [];
    let t = 0;
    (plan.scenes ?? []).forEach((s, i) => {
      const start = s.start ?? t;
      const end = s.end ?? (s.duration != null ? start + s.duration : null);
      if (start < t - 0.001) problems.push(`scenes[${i}] (${s.type}): starts at ${start}s, before the previous scene ends (${t}s)`);
      if (end != null && end <= start) problems.push(`scenes[${i}] (${s.type}): end must be after start`);
      if (end == null && i < plan.scenes.length - 1 && plan.scenes[i + 1].start == null) problems.push(`scenes[${i}] (${s.type}): needs "end" or "duration" (or the next scene needs "start")`);
      t = end ?? plan.scenes[i + 1]?.start ?? start;
    });
    (plan.words ?? []).forEach((w, i) => {
      if (w.end < w.start) problems.push(`words[${i}] ("${w.text}"): end is before start`);
    });
    return problems;
  }
  // keep the errors that say something: drop the "if/then" wrappers ajv adds
  const seen = new Set();
  return validator.errors
    .filter((e) => e.keyword !== "if")
    .map((e) => {
      const where = e.instancePath.replace(/^\//, "").replace(/\/(\d+)/g, "[$1]").replace(/\//g, ".") || "plan";
      const extra = e.keyword === "additionalProperties" ? ` "${e.params.additionalProperty}"` : e.keyword === "enum" || e.keyword === "const" ? ` (${JSON.stringify(e.params.allowedValues ?? e.params.allowedValue)})` : "";
      return `${where}: ${e.message}${extra}`;
    })
    .filter((m) => !seen.has(m) && seen.add(m));
};

/* ------------------------------------------------------------------ helpers */

const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => reject(new Error(`${cmd} could not be started: ${e.message}`)));
    p.on("close", (code) => (code === 0 ? resolve({ out, err }) : reject(new Error(`${cmd} exited with ${code}: ${err.slice(-800)}`))));
  });

const MIME = { ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".aac": "audio/aac", ".ogg": "audio/ogg", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

/** Serves chosen local files on 127.0.0.1 so the renderer can load them like any other URL. */
const startFileServer = async () => {
  const files = new Map();
  const server = http.createServer((req, res) => {
    const file = files.get(decodeURIComponent((req.url ?? "").split("?")[0]));
    if (!file) return res.writeHead(404).end();
    const size = statSync(file).size;
    const type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
    if (m) {
      const start = m[1] ? Number(m[1]) : 0;
      const end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
      res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1, "Accept-Ranges": "bytes", "Access-Control-Allow-Origin": "*" });
      return createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { "Content-Type": type, "Content-Length": size, "Accept-Ranges": "bytes", "Access-Control-Allow-Origin": "*" });
    createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  let n = 0;
  return {
    add: (file) => {
      const key = `/${n++}${path.extname(file)}`;
      files.set(key, file);
      return `http://127.0.0.1:${port}${key}`;
    },
    used: () => n > 0,
    close: () => new Promise((r) => server.close(r)),
  };
};

/** Turns local file references into URLs the renderer can read. `baseDir` is the folder of the plan file; without it, local paths are refused. */
const resolveMedia = (plan, baseDir, fileServer) => {
  const fix = (ref, what, allowBundled) => {
    if (!ref || isUrl(ref)) return ref;
    if (allowBundled && existsSync(path.join(ROOT, "public", ref))) return ref; // bundled asset (for example music/tap-bed.mp3)
    if (!baseDir) throw new Error(`${what}: "${ref}" is not an http(s) URL. Local files only work with the CLI.`);
    const file = path.resolve(baseDir, ref);
    if (!existsSync(file)) throw new Error(`${what}: file not found: ${file}`);
    return fileServer.add(file);
  };
  const out = structuredClone(plan);
  out.voiceover_url = fix(out.voiceover_url, "voiceover_url", false);
  if (out.music?.url) out.music.url = fix(out.music.url, "music.url", true);
  const covers = (v) => (typeof v === "string" && !/^[a-z0-9_-]+$/i.test(v) ? fix(v, "cover", false) : v);
  for (const s of out.scenes) {
    if (!s.props) continue;
    if (s.props.cover) s.props.cover = covers(s.props.cover);
    if (Array.isArray(s.props.covers)) s.props.covers = s.props.covers.map(covers);
  }
  return out;
};

/* ------------------------------------------------------------------ bundle */

let bundlePromise;
/** Webpack bundle of the Remotion project. With TAP_PREBUILT=1 (set in the Docker image) it uses build/ as built by
    `npm run build`; otherwise it bundles the current source once per process, so local code changes always show. */
export const bundleProject = ({ force = false } = {}) => {
  if (!force && process.env.TAP_PREBUILT === "1" && existsSync(path.join(BUILD_DIR, "index.html"))) return Promise.resolve(BUILD_DIR);
  if (!bundlePromise || force) {
    const outDir = force ? BUILD_DIR : mkdtempSync(path.join(os.tmpdir(), "tap-bundle-"));
    bundlePromise = import("@remotion/bundler").then(({ bundle }) => bundle({ entryPoint: path.join(ROOT, "src/index.ts"), outDir, publicDir: path.join(ROOT, "public") }));
  }
  return bundlePromise;
};

/* ------------------------------------------------------------------ audio */

/** Two-pass EBU R128 normalisation to `target` LUFS (true peak -1.5 dB); video is copied, audio becomes AAC 48 kHz. */
export const normalizeLoudness = async (input, output, target = -14) => {
  const base = `loudnorm=I=${target}:TP=-1.5:LRA=11`;
  const { err } = await run(FFMPEG, ["-hide_banner", "-nostats", "-i", input, "-vn", "-af", `${base}:print_format=json`, "-f", "null", "-"]);
  const m = err.slice(err.lastIndexOf("{")).match(/\{[\s\S]*\}/);
  const s = m ? JSON.parse(m[0]) : null;
  const measured = s && isFinite(Number(s.input_i)) ? `:measured_I=${s.input_i}:measured_TP=${s.input_tp}:measured_LRA=${s.input_lra}:measured_thresh=${s.input_thresh}:linear=true` : "";
  await run(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-c:v", "copy", "-af", base + measured, "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", output]);
};

export const measureLoudness = async (file) => {
  const { err } = await run(FFMPEG, ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"]);
  const tail = err.slice(err.lastIndexOf("Summary:"));
  return { lufs: Number(/I:\s+(-?[\d.]+) LUFS/.exec(tail)?.[1]), peak: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(tail)?.[1]) };
};

/* ------------------------------------------------------------------ upload */

export const uploadFile = async (file, url, contentType, { method = "PUT", headers = {} } = {}) => {
  const res = await fetch(url, { method, headers: { "Content-Type": contentType, "Content-Length": String(statSync(file).size), ...headers }, body: createReadStream(file), duplex: "half" });
  if (!res.ok) throw new Error(`upload failed: ${res.status} ${res.statusText} ${(await res.text()).slice(0, 300)}`);
};

/* ------------------------------------------------------------------ render */

/**
 * Render one plan.
 * @param plan       the video plan (already parsed)
 * @param opts.out        path of the MP4 to write
 * @param opts.thumbnail  path of the JPEG to write (default: next to the MP4)
 * @param opts.baseDir    folder that local file references in the plan are relative to (CLI only)
 * @param opts.onProgress called with { stage, progress }
 * @param opts.upload     false to skip the uploads in plan.output
 */
export const renderPlan = async (plan, opts = {}) => {
  const problems = validatePlan(plan);
  if (problems.length) throw Object.assign(new Error(`Invalid plan:\n- ${problems.join("\n- ")}`), { problems });
  const onProgress = opts.onProgress ?? (() => {});
  const out = path.resolve(opts.out ?? "out.mp4");
  const thumb = path.resolve(opts.thumbnail ?? out.replace(/\.mp4$/i, "") + ".jpg");
  mkdirSync(path.dirname(out), { recursive: true });
  const tmp = mkdtempSync(path.join(os.tmpdir(), "tap-render-"));
  const fileServer = await startFileServer();
  const started = Date.now();
  try {
    const inputProps = { plan: resolveMedia(plan, opts.baseDir, fileServer) };
    onProgress({ stage: "bundling", progress: 0 });
    const serveUrl = await bundleProject();
    const { renderMedia, renderStill, selectComposition } = await import("@remotion/renderer");
    const chromiumOptions = { gl: process.env.REMOTION_GL || undefined };
    const composition = await selectComposition({ serveUrl, id: "TapVideo", inputProps, chromiumOptions });
    const raw = path.join(tmp, "raw.mp4");
    await renderMedia({
      composition,
      serveUrl,
      inputProps,
      codec: "h264",
      audioCodec: "aac",
      crf: Number(process.env.RENDER_CRF ?? 18),
      pixelFormat: "yuv420p",
      imageFormat: "jpeg",
      jpegQuality: 92,
      outputLocation: raw,
      concurrency: process.env.RENDER_CONCURRENCY ? Number(process.env.RENDER_CONCURRENCY) : null,
      timeoutInMilliseconds: 180000,
      chromiumOptions,
      logLevel: "error",
      onProgress: ({ progress }) => onProgress({ stage: "rendering", progress }),
    });
    onProgress({ stage: "normalizing", progress: 1 });
    const hasAudio = Boolean(plan.voiceover_url || plan.music?.url);
    if (hasAudio) await normalizeLoudness(raw, out, plan.output?.loudness ?? -14);
    else await run(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-i", raw, "-c", "copy", "-movflags", "+faststart", out]);
    onProgress({ stage: "thumbnail", progress: 1 });
    const seconds = composition.durationInFrames / composition.fps;
    const frame = Math.min(composition.durationInFrames - 1, Math.round(Math.min(plan.output?.thumbnail_time ?? 1.5, seconds) * composition.fps));
    await renderStill({ composition, serveUrl, inputProps, frame, output: thumb, imageFormat: "jpeg", jpegQuality: 90, chromiumOptions, logLevel: "error" });
    const result = { video: out, thumbnail: thumb, duration: seconds, width: composition.width, height: composition.height, fps: composition.fps, bytes: statSync(out).size, video_url: null, thumbnail_url: null };
    if (hasAudio) Object.assign(result, { loudness: await measureLoudness(out) });
    const o = plan.output ?? {};
    if (opts.upload !== false && (o.upload_url || o.thumbnail_upload_url)) {
      onProgress({ stage: "uploading", progress: 1 });
      const how = { method: o.upload_method ?? "PUT", headers: o.upload_headers ?? {} };
      if (o.upload_url) {
        await uploadFile(out, o.upload_url, "video/mp4", how);
        result.video_url = o.public_url ?? o.upload_url.split("?")[0];
      }
      if (o.thumbnail_upload_url) {
        await uploadFile(thumb, o.thumbnail_upload_url, "image/jpeg", how);
        result.thumbnail_url = o.thumbnail_public_url ?? o.thumbnail_upload_url.split("?")[0];
      }
    }
    result.render_seconds = Math.round((Date.now() - started) / 100) / 10;
    onProgress({ stage: "done", progress: 1 });
    return result;
  } finally {
    await fileServer.close();
    rmSync(tmp, { recursive: true, force: true });
  }
};
