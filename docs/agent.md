# TAP Studio Agent

One job in, one finished 9:16 video out, with no human in the loop.

```
job.json ──► Trigger.dev task `generate-video` ──► agent (Claude Agent SDK)
                                                     │  skills: .claude/skills/*
                                                     │  tools:  VidLab (images, video, speech, song-ad)
                                                     │          render --plan plan.json --out final.mp4   ← the renderer in this repo
                                                     ▼
              progress + result webhooks (HMAC)   MP4 + thumbnail ──► PUT to your Bunny URL
```

| Path | What |
|---|---|
| `agent/index.mjs` | `runJob(job)`: validates the job, runs the agent, checks, uploads, reports |
| `agent/tools/index.mjs` | the agent's tools (budget-capped VidLab calls, voiceover with word timings, `validate_plan`, `render_plan`, `frames`, `safety_check`, `finish`) |
| `agent/lib.mjs` | VidLab client, budget ledger, safety scan, signed webhooks, uploads |
| `agent/CLAUDE.md` | the agent's standing instructions |
| `agent/run.mjs` | run one job locally |
| `.claude/skills/` | `motion-vsl`, `reaction-showcase`, `song-ad` (one per format), `vidlab`, `editing`, `novelty`, `safety` |
| `schemas/job.schema.json`, `schemas/result.schema.json` | the task's input and output |
| `src/trigger/generate-video.ts`, `trigger.config.ts` | the Trigger.dev task and its build (ffmpeg, Chrome Headless Shell, fonts and assets from the repo) |
| `examples/jobs/` | one job per format for the TAP Affiliate Starter Course |
| `.github/workflows/deploy-trigger.yml` | deploys `main` to Trigger.dev Production |

## Formats

| `format` | What the agent makes | Paid VidLab steps |
|---|---|---|
| `motion_vsl` | A voiced motion-graphics video, every frame from the renderer | voiceover (`minimax-speech-2.8`) |
| `reaction_showcase` | An AI reaction clip with a hook headline, then a motion-graphics showcase | start frame (`ugc-image-1`), clip (`seedance-2.5`, image-to-video), voiceover |
| `song_ad` | VidLab's `song-ad` system video (an original song sung by an animated character) with a renderer hook and end card | the `song-ad` system run |

The renderer makes every motion-graphics frame in all three: AI clips are placed in a `footage` scene, so headlines, tags, captions and the end card are the same components as the reference ads.

## The job

```json
{
  "job_id": "starter-course-motion-vsl-001",
  "format": "motion_vsl",
  "product": {
    "name": "TAP Affiliate Starter Course",
    "price": "$5",
    "facts": ["The course is 5 short lessons that take you to your first live offer."]
  },
  "brief": "Audience: people who think they need followers. Angle: objection. Calm, direct.",
  "duration_s": 30,
  "budget": { "max_usd": 0.5 },
  "output": {
    "upload_url": "https://storage.bunnycdn.com/YOUR_STORAGE_ZONE/tap-studio/starter-course-motion-vsl-001.mp4",
    "public_url": "https://YOUR_PULL_ZONE.b-cdn.net/tap-studio/starter-course-motion-vsl-001.mp4"
  },
  "webhooks": {
    "progress_url": "https://your-app.example.com/api/tap-studio/progress",
    "result_url": "https://your-app.example.com/api/tap-studio/result"
  }
}
```

Every field is described in [`schemas/job.schema.json`](../schemas/job.schema.json). The ones that matter most:

- **`product.facts`**: the agent states only what is here, in the brief or in `script`. It does not invent numbers or results.
- **`budget.max_usd`**: a hard cap on VidLab spending. Each paid call is priced first and refused if it would pass the cap. `budget.max_agent_usd` (default 3) caps the agent's own model usage.
- **`compliance`**: `meta_safe` (default) applies the Meta ad rules in `.claude/skills/safety`. The plan, the captions and the script are scanned before rendering and again before hand-in; a video that fails is not delivered.
- **`output.upload_url`**: the MP4 is sent with an HTTP `PUT`. For Bunny Stream (`https://video.bunnycdn.com/library/<library>/videos/<video id>`) the `AccessKey` header comes from `BUNNY_STREAM_API_KEY`; for Bunny Storage (`https://storage.bunnycdn.com/<zone>/<path>`) from `BUNNY_STORAGE_API_KEY`; a job can override it with `upload_headers`.

## The result

Returned by the task and POSTed to `webhooks.result_url` ([`schemas/result.schema.json`](../schemas/result.schema.json)):

```json
{
  "event": "job.result",
  "job_id": "starter-course-motion-vsl-001",
  "run_id": "run_…",
  "status": "succeeded",
  "format": "motion_vsl",
  "video_url": "https://YOUR_PULL_ZONE.b-cdn.net/tap-studio/starter-course-motion-vsl-001.mp4",
  "thumbnail_url": null,
  "video": { "duration_s": 31.4, "width": 1080, "height": 1920, "fps": 30, "bytes": 11200000, "loudness_lufs": -14.3 },
  "title": "…",
  "summary": "…",
  "script": "…",
  "cost": { "vidlab_usd": 0.09, "agent_usd": 0.8, "total_usd": 0.89, "items": [] },
  "safety": { "mode": "meta_safe", "passed": true, "findings": [] },
  "agent": { "model": "claude-fable-5-2", "turns": 24, "seconds": 410 },
  "started_at": "…",
  "finished_at": "…",
  "error": null
}
```

A job that cannot be completed still returns a result, with `"status": "failed"` and `error: { code, message }` (`invalid_job`, `missing_env`, `budget_exceeded`, `no_video`, `upload_failed`, …). The task itself only throws on an infrastructure fault.

## Webhooks

Both are JSON `POST`s. Progress events look like `{ "event": "job.progress", "job_id", "run_id", "stage", "message", "spent_usd", "at" }` with stages `started`, `working`, `voiceover`, `generating`, `rendering`, `uploading`; they are sent at most every 3 seconds and are best-effort. The result is retried up to 3 times.

Each request is signed:

```
X-Tap-Timestamp: 1790000000
X-Tap-Signature: sha256=<hex HMAC-SHA256 of "<timestamp>.<raw body>" with the secret>
```

The secret is `webhooks.secret` in the job, or else the `WEBHOOK_HMAC_SECRET` environment variable. Verify in your app:

```js
const expected = "sha256=" + crypto.createHmac("sha256", secret).update(`${req.headers["x-tap-timestamp"]}.${rawBody}`).digest("hex");
const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(req.headers["x-tap-signature"]));
```

## Environment variables

| Name | Needed | What |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | the agent's model access |
| `VIDLAB_API_KEY` | yes | VidLab generations (also the voiceover for `motion_vsl`) |
| `BUNNY_STREAM_API_KEY` | for Bunny Stream uploads | sent as `AccessKey` when `upload_url` is on `video.bunnycdn.com` |
| `BUNNY_STORAGE_API_KEY` | for Bunny Storage uploads | storage zone password, sent as `AccessKey` when `upload_url` is on `storage.bunnycdn.com` |
| `WEBHOOK_HMAC_SECRET` | if you use webhooks | default HMAC secret |
| `AGENT_MODEL` | no | default `claude-fable-5-2` |
| `TRIGGER_PROJECT_REF` | build time | your Trigger.dev project ref (`proj_…`) |

## Run a job locally

Put the keys in `.env` (see `.env.example`; it is git-ignored), then:

```bash
node agent/run.mjs --job examples/jobs/motion_vsl.json --keep out/jobs
```

`--keep` copies the MP4, thumbnail and final plan to that folder. `--validate-only` checks a job against the schema. The example jobs upload to placeholder Bunny URLs: change `output` first.

## Deploy to Trigger.dev

**GitHub Actions (in this repo).** `.github/workflows/deploy-trigger.yml` deploys every push to `main` to Production. Set once, in the GitHub repository settings (Secrets and variables → Actions):

- secret `TRIGGER_ACCESS_TOKEN`: an API key of your project's **Production** environment (Trigger.dev dashboard → your project → Production → API keys → New API key);
- variable `TRIGGER_PROJECT_REF`: your project ref (`proj_…`);
- optionally the secrets `ANTHROPIC_API_KEY`, `VIDLAB_API_KEY`, `BUNNY_STORAGE_API_KEY`, `WEBHOOK_HMAC_SECRET`: when present they are copied into Trigger.dev Production on each deploy. Otherwise set them in the dashboard under Environment variables.

**From your machine.**

```bash
TRIGGER_PROJECT_REF=proj_xxx npx trigger.dev@4.8.8 deploy --env prod
```

Deploying replaces the project's current Production version: tasks that exist only in another codebase stop being available there. Use a project of its own for this repo, or keep all of a project's tasks in one repo.

**Trigger a run** from your app:

```ts
import { tasks } from "@trigger.dev/sdk";
const handle = await tasks.trigger("generate-video", job);
```

## Adding a format

1. Add the value to `format` in both schemas.
2. Write `.claude/skills/<format>/SKILL.md` (the steps, the scenes that work, the budget plan) and add it to `FORMAT_SKILL` and the `skills` list in `agent/index.mjs`.
3. If it needs a new capability, add a tool in `agent/tools/index.mjs` (go through the ledger for anything paid) and list its name in `TOOL_NAMES`.
4. Add an example job in `examples/jobs/`.
