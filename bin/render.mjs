#!/usr/bin/env node
// render --plan plan.json --out out.mp4
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderPlan, validatePlan } from "../lib/pipeline.mjs";

const HELP = `Render a TAP video plan to an MP4 (1080x1920, H.264 + AAC, about -14 LUFS) and a JPEG thumbnail.

Usage:
  render --plan <plan.json> --out <out.mp4> [options]

Options:
  --plan <file>        the video plan (JSON), or "-" to read it from stdin
  --out <file>         where to write the MP4 (default: out.mp4)
  --thumbnail <file>   where to write the thumbnail (default: next to the MP4, .jpg)
  --no-upload          do not upload to output.upload_url, only write the files
  --lambda             render on AWS Lambda (see README, "Remotion Lambda")
  --validate-only      check the plan against the schema and exit
  --json               print the result as JSON on stdout
  -h, --help           show this help
`;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
if (flag("-h") || flag("--help") || !args.length) {
  console.log(HELP);
  process.exit(args.length ? 0 : 1);
}
const planArg = value("--plan") ?? (flag("--validate-only") ? args[args.indexOf("--validate-only") + 1] : undefined);
if (!planArg) {
  console.error("Missing --plan <file>.\n\n" + HELP);
  process.exit(1);
}

let plan;
try {
  plan = JSON.parse(readFileSync(planArg === "-" ? 0 : planArg, "utf8"));
} catch (e) {
  console.error(`Could not read the plan "${planArg}": ${e.message}`);
  process.exit(1);
}
const problems = validatePlan(plan);
if (problems.length) {
  console.error(`The plan is not valid:\n- ${problems.join("\n- ")}`);
  process.exit(2);
}
if (flag("--validate-only")) {
  console.log(`OK: ${plan.scenes.length} scenes, ${plan.words?.length ?? 0} words`);
  process.exit(0);
}

const out = value("--out") ?? "out.mp4";
const json = flag("--json");
let last = "";
const onProgress = ({ stage, progress }) => {
  const line = stage === "rendering" ? `rendering ${Math.round(progress * 100)}%` : stage;
  if (line !== last && !json) process.stderr.write(`${line}\n`);
  last = line;
};
try {
  const opts = { out, thumbnail: value("--thumbnail"), baseDir: planArg === "-" ? process.cwd() : path.dirname(path.resolve(planArg)), upload: !flag("--no-upload"), onProgress };
  const result = flag("--lambda") ? await (await import("../lib/lambda.mjs")).renderPlanOnLambda(plan, opts) : await renderPlan(plan, opts);
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`video:     ${result.video} (${result.duration.toFixed(1)} s, ${(result.bytes / 1e6).toFixed(1)} MB${result.loudness ? `, ${result.loudness.lufs} LUFS` : ""})`);
    console.log(`thumbnail: ${result.thumbnail}`);
    if (result.video_url) console.log(`uploaded:  ${result.video_url}`);
    if (result.thumbnail_url) console.log(`uploaded:  ${result.thumbnail_url}`);
  }
} catch (e) {
  console.error(`Render failed: ${e.message}`);
  process.exit(3);
}
process.exit(0);
