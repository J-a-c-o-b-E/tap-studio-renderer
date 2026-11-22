#!/usr/bin/env node
// Run one job locally:  node agent/run.mjs --job examples/jobs/motion_vsl.json [--keep out/jobs]
// Reads keys from the environment or .env in the repo root (never printed).
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.TAP_ROOT ??= root;
const envFile = path.join(root, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
const args = process.argv.slice(2);
const value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const jobFile = value("--job");
if (!jobFile) {
  console.error("usage: node agent/run.mjs --job <job.json> [--keep <folder>] [--validate-only]");
  process.exit(1);
}
const { runJob, validateJob } = await import("./index.mjs");
const job = JSON.parse(readFileSync(jobFile, "utf8"));
if (args.includes("--validate-only")) {
  const problems = validateJob(job);
  console.log(problems.length ? `invalid job:\n- ${problems.join("\n- ")}` : `OK: ${job.format} job ${job.job_id}`);
  process.exit(problems.length ? 2 : 0);
}
const result = await runJob(job, { keepDir: value("--keep"), onEvent: (e) => e.event === "job.progress" && process.stderr.write(`[${e.stage}] ${e.message} ($${e.spent_usd.toFixed(2)})\n`) });
console.log(JSON.stringify(result, null, 2));
process.exit(result.status === "succeeded" ? 0 : 3);
