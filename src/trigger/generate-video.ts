import { logger, metadata, task } from "@trigger.dev/sdk";
import { existsSync } from "node:fs";
import path from "node:path";
import { runJob } from "../../agent/index.mjs";

/**
 * generate-video: one TAP Studio video job in, one result out.
 * Payload: schemas/job.schema.json. Output: schemas/result.schema.json.
 * Progress and the result are also sent to the job's webhooks, signed with HMAC-SHA256.
 * A job that fails (bad input, budget, a model error) still returns a result, with status "failed".
 */
export const generateVideo = task({
  id: "generate-video",
  machine: "large-1x",
  maxDuration: 3600,
  retry: { maxAttempts: 1 }, // a retry would pay for the generations again
  queue: { concurrencyLimit: 3 },
  run: async (payload: Record<string, any>, { ctx, signal }) => {
    // the deployed image carries the renderer's pre-built bundle (build/), so renders do not bundle at run time
    if (existsSync(path.join(process.cwd(), "build/index.html"))) process.env.TAP_PREBUILT ??= "1";
    process.env.AGENT_WORK_DIR ??= "/tmp/tap-jobs";
    const result = await runJob(payload, {
      runId: ctx.run.id,
      signal,
      onEvent: (event: Record<string, any>) => {
        if (event.event !== "job.progress") return;
        metadata.set("stage", event.stage);
        metadata.set("message", event.message);
        metadata.set("spent_usd", event.spent_usd);
        logger.info(`${event.stage}: ${event.message}`, { spent_usd: event.spent_usd });
      },
    });
    metadata.set("stage", result.status);
    if (result.status === "failed") logger.error("job failed", { error: result.error });
    return result;
  },
});
