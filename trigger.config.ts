import { additionalFiles, additionalPackages, aptGet, ffmpeg, syncEnvVars } from "@trigger.dev/build/extensions/core";
import type { BuildExtension } from "@trigger.dev/build";
import { defineConfig } from "@trigger.dev/sdk";
import { execFileSync } from "node:child_process";

/* Trigger.dev build for the TAP Studio Agent.
   The task `generate-video` (src/trigger) runs the agent, and the agent calls the renderer as a child process
   (`node bin/render.mjs --plan ... --out ...`). So the image needs: ffmpeg, Chrome Headless Shell and its
   libraries, the renderer's files and packages, the pre-built Remotion bundle, fonts and assets (all in the repo). */

// The keys the task needs at run time. On deploy, any of these present in the deploy environment
// (GitHub Actions secrets, or your shell) are copied into the Trigger.dev environment being deployed to.
const RUNTIME_ENV = ["ANTHROPIC_API_KEY", "VIDLAB_API_KEY", "BUNNY_STORAGE_API_KEY", "WEBHOOK_SECRET", "AGENT_MODEL"];
const SECRET = new Set(["ANTHROPIC_API_KEY", "VIDLAB_API_KEY", "BUNNY_STORAGE_API_KEY", "WEBHOOK_SECRET"]);

/** Builds the Remotion bundle (build/) before the deploy, and installs Chrome Headless Shell in the image. */
const renderer = (): BuildExtension => ({
  name: "tap-renderer",
  onBuildStart: async (context) => {
    if (context.target !== "deploy") return;
    context.logger.log("Bundling the renderer (npm run build)");
    execFileSync("npm", ["run", "build"], { cwd: context.workingDir, stdio: "inherit" });
  },
  onBuildComplete: async (context) => {
    if (context.target !== "deploy") return;
    context.addLayer({
      id: "tap-renderer-browser",
      commands: ["npx remotion browser ensure"],
    });
  },
});

export default defineConfig({
  // Your project ref (proj_...), from the Trigger.dev dashboard: Project settings.
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_SET_TRIGGER_PROJECT_REF",
  runtime: "node",
  dirs: ["./src/trigger"],
  maxDuration: 3600,
  machine: "large-1x",
  legacyDevProcessCwdBehaviour: false,
  retries: { enabledInDev: false, default: { maxAttempts: 1 } },
  build: {
    // not bundled: the Agent SDK ships its own executable
    external: ["@anthropic-ai/claude-agent-sdk"],
    extensions: [
      ffmpeg(),
      // libraries Chrome Headless Shell needs (https://www.remotion.dev/docs/docker)
      aptGet({ packages: ["libnss3", "libdbus-1-3", "libatk1.0-0", "libgbm-dev", "libasound2", "libxrandr2", "libxkbcommon-dev", "libxfixes3", "libxcomposite1", "libxdamage1", "libatk-bridge2.0-0", "libpango-1.0-0", "libcairo2", "libcups2", "ca-certificates"] }),
      // what the renderer process imports at run time (the task bundle itself does not import these)
      additionalPackages({ packages: ["@remotion/renderer@4.0.533", "@remotion/cli@4.0.533", "remotion@4.0.533", "ajv@8"] }),
      // the renderer command, its schema and pre-built bundle, the agent's instructions and skills
      additionalFiles({ files: ["bin/**", "lib/**", "schema/**", "schemas/**", "docs/scenes.md", "examples/*.plan.json", "agent/CLAUDE.md", ".claude/skills/**", "build/**"] }),
      renderer(),
      syncEnvVars(async () => RUNTIME_ENV.filter((name) => process.env[name]).map((name) => ({ name, value: process.env[name] as string, isSecret: SECRET.has(name) }))),
    ],
  },
});
