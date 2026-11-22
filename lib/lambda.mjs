// Remotion Lambda option: the frames are rendered on AWS Lambda, then this machine finishes the file
// (loudness to -14 LUFS, thumbnail, upload) exactly like a local render.
// Needs: `npm run lambda:deploy` once, AWS credentials in the environment, and public http(s) URLs in the plan.
import { createWriteStream, mkdirSync, mkdtempSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import { measureLoudness, normalizeLoudness, uploadFile, validatePlan } from "./pipeline.mjs";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const need = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set (see README, "Remotion Lambda")`);
  return v;
};
const ffmpeg = (args) =>
  new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, args, { stdio: "ignore" });
    p.on("error", reject);
    p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${c}`))));
  });

export const renderPlanOnLambda = async (plan, opts = {}) => {
  const problems = validatePlan(plan);
  if (problems.length) throw new Error(`Invalid plan:\n- ${problems.join("\n- ")}`);
  for (const [what, ref] of [["voiceover_url", plan.voiceover_url], ["music.url", plan.music?.url]]) {
    if (ref && !/^https?:\/\//.test(ref) && !ref.startsWith("music/")) throw new Error(`${what}: Lambda rendering needs an http(s) URL, got "${ref}"`);
  }
  const { getRenderProgress, renderMediaOnLambda } = await import("@remotion/lambda/client");
  const region = need("REMOTION_AWS_REGION");
  const functionName = need("REMOTION_FUNCTION_NAME");
  const serveUrl = need("REMOTION_SERVE_URL");
  const onProgress = opts.onProgress ?? (() => {});
  const started = Date.now();
  const inputProps = { plan };
  const { renderId, bucketName } = await renderMediaOnLambda({ region, functionName, serveUrl, composition: "TapVideo", inputProps, codec: "h264", audioCodec: "aac", crf: 18, imageFormat: "jpeg", jpegQuality: 92, privacy: "private", maxRetries: 1 });
  let outputFile;
  for (;;) {
    await new Promise((r) => setTimeout(r, 2000));
    const p = await getRenderProgress({ renderId, bucketName, functionName, region });
    if (p.fatalErrorEncountered) throw new Error(`Lambda render failed: ${p.errors?.[0]?.message ?? "unknown error"}`);
    onProgress({ stage: "rendering", progress: p.overallProgress });
    if (p.done) {
      outputFile = p.outKey;
      break;
    }
  }
  const { presignUrl } = await import("@remotion/lambda/client");
  const rawUrl = await presignUrl({ region, bucketName, objectKey: outputFile, expiresInSeconds: 900 });
  const out = path.resolve(opts.out ?? "out.mp4");
  const thumb = path.resolve(opts.thumbnail ?? out.replace(/\.mp4$/i, "") + ".jpg");
  mkdirSync(path.dirname(out), { recursive: true });
  const tmp = mkdtempSync(path.join(os.tmpdir(), "tap-lambda-"));
  try {
    const raw = path.join(tmp, "raw.mp4");
    const res = await fetch(rawUrl);
    if (!res.ok) throw new Error(`could not download the Lambda render: HTTP ${res.status}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(raw));
    onProgress({ stage: "normalizing", progress: 1 });
    await normalizeLoudness(raw, out, plan.output?.loudness ?? -14);
    await ffmpeg(["-hide_banner", "-loglevel", "error", "-y", "-ss", String(plan.output?.thumbnail_time ?? 1.5), "-i", out, "-frames:v", "1", "-q:v", "3", thumb]);
    const loudness = await measureLoudness(out);
    const result = { video: out, thumbnail: thumb, duration: null, width: 1080, height: 1920, fps: 30, bytes: statSync(out).size, loudness, video_url: null, thumbnail_url: null, lambda: { renderId, bucketName } };
    const o = plan.output ?? {};
    if (opts.upload !== false) {
      const how = { method: o.upload_method ?? "PUT", headers: o.upload_headers ?? {} };
      if (o.upload_url) {
        onProgress({ stage: "uploading", progress: 1 });
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
    rmSync(tmp, { recursive: true, force: true });
  }
};
