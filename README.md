# tap-studio-renderer

Headless renderer for TAP Affiliate Network video ads. It takes one JSON **video plan** (voiceover + word timings + an ordered list of scenes) and produces a finished **1080×1920 MP4** (H.264 + AAC, 30 fps, about −14 LUFS) and a **JPEG thumbnail**, then uploads both to the URLs given in the plan.

It reproduces the look of the C1 "safe B" ads exactly: orange `#F7A12E`, black `#0A0A0A`, cream `#F4EFE6`, Anton headlines and Inter Tight labels, white cards with a 3 px border and a hard shadow, word-by-word slams, 150 ms pops, whip / zoom cuts, and the karaoke caption pill with the current word in orange.

Built on [Remotion](https://www.remotion.dev) 4. Everything it needs (fonts, logo, cover photos, a music bed) is in this repo; nothing is read from a local machine.

```bash
render --plan plan.json --out out.mp4
```

## Contents

| Path | What |
|---|---|
| `bin/render.mjs` | the `render` command |
| `server/server.mjs` | HTTP server: `POST /render`, job status, webhook |
| `lib/pipeline.mjs` | validate → render → loudness → thumbnail → upload |
| `lib/lambda.mjs`, `scripts/lambda-deploy.mjs` | Remotion Lambda option |
| `schema/scenes.mjs` | scene type definitions (source of the schema and the docs) |
| `schema/plan.schema.json` | JSON Schema of the plan (generated) |
| `docs/scenes.md` | every scene type and its props (generated) |
| `examples/` | three plans that recreate the C1 ads, with their voiceovers |
| `src/` | the Remotion project: `scenes.tsx`, `ui.tsx`, `Captions.tsx`, `Video.tsx` |
| `public/` | bundled fonts, TAP mark, cover photos, music bed |
| `Dockerfile` | image with Chrome Headless Shell, ffmpeg and the pre-built bundle |

## The plan

```json
{
  "version": 1,
  "aspect": "9:16",
  "fps": 30,
  "voiceover_url": "https://cdn.example.com/vo/123.mp3",
  "words": [
    { "text": "Zero", "start": 0.08, "end": 0.31 },
    { "text": "followers.", "start": 0.35, "end": 0.9 }
  ],
  "music": { "url": "music/tap-bed.mp3", "volume": 0.023 },
  "scenes": [
    { "type": "pills", "start": 0, "end": 4.2, "props": { "flip": true, "items": [{ "text": "0 FOLLOWERS", "cue": "zero" }] } },
    { "type": "cta", "start": 4.2, "end": 8, "props": { "cue": 0.4 } }
  ],
  "output": {
    "upload_url": "https://bucket.s3.amazonaws.com/videos/123.mp4?X-Amz-Signature=...",
    "thumbnail_upload_url": "https://bucket.s3.amazonaws.com/videos/123.jpg?X-Amz-Signature=...",
    "public_url": "https://cdn.example.com/videos/123.mp4"
  },
  "webhook_url": "https://app.example.com/hooks/render"
}
```

- **`voiceover_url`** and **`words`**: the audio and its word-level timestamps in seconds (ElevenLabs "with timestamps", Whisper, or any forced aligner). `text` is what the caption shows, so write `$5` and `240+`, not "five dollars".
- **`scenes`**: in order. Each has a `type`, a time range (`start`/`end`, or `duration` to run back to back) and `props`. A scene stays up until the next one starts; the last one runs to the end.
- **Cues**: inside `props`, a `cue` says when an element appears: a **word** spoken during that scene (`"zero"`, `"240"`) or **seconds from the scene start** (`0.4`).
- **`music`** is optional. `music/tap-bed.mp3` is the bundled track; any URL works. It loops and fades out over the last 2 s.
- **`output`**: both files are sent with an HTTP `PUT` (pre-signed S3 / R2 / GCS URLs work as they are). `public_url` is what gets reported back as `video_url`.
- **Length**: `duration`, or else the later of the last scene end and the last word end + `tail` (1.5 s, so the end card holds).

Full reference: [`schema/plan.schema.json`](schema/plan.schema.json) and [`docs/scenes.md`](docs/scenes.md). Point your editor at the schema with `"$schema": "../schema/plan.schema.json"` for autocomplete.

### Scene types

| Type | What it is |
|---|---|
| `ticker` | Ticker tape banners with optional headline (a single tape is also the `tape` prop on `pills`, `strike_list`, `profile`) |
| `pills` | Pill list with crosses that flip to ticks ("0 FOLLOWERS / NO PRODUCT / NO FACE") |
| `checklist` | Checklist card with ticks (highlighted) and crosses (struck through) |
| `strike_list` | Strike-through list of cards with a footer line |
| `headline` | Big headline, last line in the orange highlight box |
| `phones` | Phone mockups row with platform badges and a "LINK IN BIO" tag |
| `icon_flow` | Icon row (apps / Telegram / brands) → arrow → action pills → arrow → stamped word |
| `logo_stats` | TAP logo + stat cards ("240+ AFFILIATES", "110+ OFFERS"), optionally with the product box |
| `product_box` | Product box ("TAP AFFILIATE STARTER COURSE") with lesson cards or a footer |
| `steps` | Numbered steps list |
| `big_number` | Big number ("5 SHORT LESSONS") + the 1-on-1 card |
| `price_tag` | Hanging price tag ("$5") |
| `launch_grid` | Launch-price headline + grid of 100 member slots |
| `clock` | Ticking clock ("THERE'S STILL TIME") |
| `cta` | Final CTA card ("GET STARTED – $5" with arrows) |
| `block_stack` | Blocks stack up under a headline and fall over |
| `have_need` | "THEY HAVE the product / THEY NEED customers" |
| `walk` | People walking from a post to a brand → stamped word |
| `swipe_phone` | One phone swiping through a slideshow |
| `profile` | A new profile on a phone ("1 FOLLOWER", four posts) |
| `views` | A post, a views card and a stamp ("NOT VIRAL") |
| `result_card` | Big tick card ("1 PAID CONVERSION") |
| `fan_out` | A post with rings of people fanning out ("FOLLOWERS DON'T MATTER") |

Backgrounds are `cream` (dot grid), `orange` and `black`, set with `bg` on the scenes that allow it. The caption pill runs over every scene unless `captions.enabled` is `false`.

### Examples

`examples/` holds three plans that recreate the ads this renderer was extracted from:

| Plan | Length |
|---|---|
| `examples/C1_V01B_main.plan.json` | 61 s |
| `examples/C1_V02B_product.plan.json` | 54 s |
| `examples/C1_V03B_onefollower.plan.json` | 49 s |

They use local voiceover files (`examples/media/`), which the CLI accepts. Over HTTP, use URLs.

## Run it locally

Needs Node 20+ and `ffmpeg` on the PATH (`brew install ffmpeg` / `apt install ffmpeg`).

```bash
npm install
```

```bash
npx remotion browser ensure
```

```bash
node bin/render.mjs --plan examples/C1_V01B_main.plan.json --out out/C1_V01B_main.mp4
```

Useful extras:

```bash
node bin/render.mjs --validate-only examples/C1_V01B_main.plan.json
```

```bash
npm run studio
```

`--no-upload` writes the files without uploading, `--thumbnail <file>` picks the thumbnail path, `--json` prints the result as JSON, `--plan -` reads the plan from stdin. `npm link` puts a `render` command on your PATH.

Environment variables: `RENDER_CONCURRENCY` (browser tabs, default half the cores), `RENDER_CRF` (default 18), `FFMPEG_PATH`, `REMOTION_GL` (for example `angle` or `swangle` if the default GL backend fails on a server).

## Run it in Docker

```bash
docker build -t tap-studio-renderer .
```

One render (mount a folder for the plan and the result):

```bash
docker run --rm -v "$PWD:/work" tap-studio-renderer render --plan /work/examples/C1_V01B_main.plan.json --out /work/out/C1_V01B_main.mp4
```

The HTTP server (the image's default command):

```bash
docker run --rm -p 8080:8080 -e API_TOKEN=change-me tap-studio-renderer
```

The image contains Chrome Headless Shell, ffmpeg, all fonts and assets, and a pre-built bundle (`npm run build`), so a container never downloads anything at render time. Give it at least 2 vCPU and 4 GB of memory; more cores render faster (`RENDER_CONCURRENCY` sets how many browser tabs work in parallel).

## HTTP API

Start it with `npm run serve` or the Docker image.

| Request | Result |
|---|---|
| `POST /render` with the plan as the JSON body | `202 { "job_id", "status", "status_url" }`, or `422` with a list of `problems` if the plan is invalid |
| `GET /jobs/:id` | status (`queued`, `rendering`, `done`, `failed`), `stage`, `progress`, and the result when done |
| `GET /jobs/:id/video`, `GET /jobs/:id/thumbnail` | the files, for plans without an `upload_url` (kept for `JOB_TTL_HOURS`) |
| `GET /health` | `{ ok, queued, rendering }` (no token needed) |

```bash
curl -X POST http://localhost:8080/render -H "Authorization: Bearer change-me" -H "Content-Type: application/json" --data-binary @plan.json
```

When the job ends, the plan's `webhook_url` gets a `POST` with the same body as `GET /jobs/:id` (retried up to 4 times):

```json
{
  "job_id": "5c0f…",
  "plan_id": "C1_V01B_main",
  "status": "done",
  "video_url": "https://cdn.example.com/videos/123.mp4",
  "thumbnail_url": "https://cdn.example.com/videos/123.jpg",
  "duration": 61.2,
  "width": 1080,
  "height": 1920,
  "bytes": 27300000,
  "loudness_lufs": -14.2,
  "render_seconds": 212.4,
  "error": null
}
```

On failure `status` is `failed` and `error` says why.

Server settings: `PORT` (8080), `API_TOKEN` (required as `Authorization: Bearer …` when set — **set it on anything reachable from the internet**, because the server fetches whatever URLs a plan names), `MAX_PARALLEL_RENDERS` (1), `JOBS_DIR`, `JOB_TTL_HOURS` (24), `PUBLIC_URL` (used in `status_url` and file links behind a proxy).

Jobs are kept in memory: a restart forgets queued and finished jobs. For more than one instance, put a queue in front or use Lambda rendering.

## Run it in the cloud

**A container host (simplest).** Deploy the Docker image to anything that runs a long-lived container: Fly.io, Render, Railway, Google Cloud Run (CPU always allocated, request timeout not relevant because rendering happens after the `202`), AWS ECS / App Runner, or a VPS. Set `API_TOKEN`, give it 4 vCPU / 8 GB if you can, and call `POST /render` from TAP STUDIO. One instance renders `MAX_PARALLEL_RENDERS` videos at a time and queues the rest.

**Remotion Lambda (fast, scales to zero).** The frames render in parallel on AWS Lambda; the render server then normalises loudness, makes the thumbnail and uploads, so the output is identical.

1. Give your AWS user the Remotion Lambda policies: <https://www.remotion.dev/docs/lambda/setup>.
2. Deploy the function and the site (repeat after every code change):

```bash
REMOTION_AWS_REGION=us-east-1 npm run lambda:deploy
```

3. Set the four variables it prints (`RENDER_MODE=lambda`, `REMOTION_AWS_REGION`, `REMOTION_FUNCTION_NAME`, `REMOTION_SERVE_URL`) plus the AWS credentials on the render server, or pass `--lambda` to the CLI.

With Lambda, `voiceover_url`, `music.url` and cover images must be public `http(s)` URLs (or the bundled `music/tap-bed.mp3`). Remotion Lambda needs a Remotion company licence for teams of four or more: <https://www.remotion.dev/license>.

## Add a new scene type

1. **Write the component** in `src/scenes.tsx`. It receives `{ scene, props }`. Use the blocks in `src/ui.tsx` (`Background`, `Card`, `Tag`, `Slam`, `Pop`, `Mark`, `Stamp`, `Tape`, `Phone`, `Cover`, `Logo`, `ProductBox`) and get timings from cues:

```tsx
const Quote: React.FC<SceneProps> = ({ scene, props }) => {
  const [a] = useCues(scene, [props.cue]);
  return (
    <AbsoluteFill>
      <Background kind={props.bg} />
      <div style={{ position: "absolute", left: X0, top: 500, width: SW, textAlign: "center" }}>
        <Slam t={props.text} at={a} size={150} bg={props.bg} wrap />
      </div>
    </AbsoluteFill>
  );
};
```

2. **Register it** in the `SCENES` map at the bottom of `src/scenes.tsx`: `quote: Quote`.
3. **Describe it** in `schema/scenes.mjs` (title, summary, props, example), then regenerate the schema and docs:

```bash
npm run schema
```

4. **Check it**: `npm run typecheck`, then `npm run studio` or render a short plan that uses it.

House rules for a scene: keep everything important inside x 64–1016, y 250–1260 (the caption pill sits at y ≈ 1340, and the top 250 px and bottom 580 px are covered by app UI); pop elements in over 5 frames with `Pop` / `usePop`; use only the three backgrounds and the brand colours from `src/engine.tsx`.

## What is bundled

- **Fonts** (`public/fonts`): Anton and Inter Tight, both under the SIL Open Font License.
- **Logo** (`public/brand/tap_mark.png`): the TAP mark.
- **Covers** (`public/covers`): six neutral slideshow photos (`recipe`, `travel`, `apps`, `gym`, `study`, `desk`).
- **Music** (`public/music/tap-bed.mp3`): the music bed used in the reference ads.
- **Platform marks**: from the `simple-icons` package.

## Checks

```bash
npm run typecheck
```

```bash
npm run schema
```
