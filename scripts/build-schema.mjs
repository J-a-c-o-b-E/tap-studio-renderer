// Generates schema/plan.schema.json and docs/scenes.md from schema/scenes.mjs.
import { writeFileSync } from "node:fs";
import { SCENES } from "../schema/scenes.mjs";

const url = { type: "string", minLength: 1, description: "An http(s) URL, or (CLI only) a file path relative to the plan file." };
const num = (min, desc, extra = {}) => ({ type: "number", minimum: min, description: desc, ...extra });

const sceneBase = {
  type: "object",
  required: ["type"],
  properties: {
    type: { enum: Object.keys(SCENES), description: "Scene type." },
    start: num(0, "Start time in seconds. Defaults to the end of the previous scene."),
    end: num(0, "End time in seconds. Use this or `duration`."),
    duration: num(0, "Length in seconds. Use this or `end`.", { exclusiveMinimum: 0 }),
    continue: { type: "boolean", description: "Hard cut from the previous scene with no entry transition (for a scene that continues the same picture).", default: false },
    props: { type: "object", description: "Scene-specific props, see docs/scenes.md." },
  },
  additionalProperties: false,
  allOf: Object.entries(SCENES).map(([type, def]) => ({
    if: { properties: { type: { const: type } }, required: ["type"] },
    then: {
      ...(Object.values(def.props).some((p) => p.req) ? { required: ["props"] } : {}),
      properties: {
        props: {
          type: "object",
          properties: Object.fromEntries(Object.entries(def.props).map(([k, p]) => [k, { ...p.schema, description: p.desc, ...(p.def !== undefined ? { default: p.def } : {}) }])),
          required: Object.entries(def.props).filter(([, p]) => p.req).map(([k]) => k),
          additionalProperties: false,
        },
      },
    },
  })),
};

const schema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "tap-studio-renderer/plan.schema.json",
  title: "TAP video plan",
  description: "One 9:16 TAP video: a voiceover with word timings and an ordered list of scenes.",
  type: "object",
  required: ["scenes"],
  additionalProperties: false,
  properties: {
    $schema: { type: "string" },
    version: { const: 1, description: "Plan format version." },
    id: { type: "string", description: "Your own id for this video. Echoed back in job status and the webhook." },
    aspect: { const: "9:16", description: "Always 9:16 (1080x1920)." },
    fps: { const: 30, description: "Always 30." },
    voiceover_url: { ...url, description: "The voiceover audio (mp3, wav, m4a). " + url.description },
    words: {
      type: "array",
      description: "Word-level timestamps of the voiceover, in order. They drive the caption pill and the cues.",
      items: {
        type: "object",
        required: ["text", "start", "end"],
        additionalProperties: false,
        properties: { text: { type: "string", minLength: 1, description: "The word as it should appear in the caption (for example \"$5\" or \"240+\")." }, start: num(0, "Start in seconds."), end: num(0, "End in seconds.") },
      },
    },
    duration: num(0, "Total length in seconds. Default: the later of the last scene end and the last word end + `tail`.", { exclusiveMinimum: 0 }),
    tail: num(0, "Seconds the last scene holds after the last word.", { default: 1.5 }),
    music: {
      type: ["object", "null"],
      description: "Optional background music, looped under the voice and faded out over the last 2 s.",
      additionalProperties: false,
      properties: {
        url: { type: "string", minLength: 1, description: "An http(s) URL, a path relative to the plan file (CLI only), or `music/tap-bed.mp3` for the bundled track." },
        volume: { type: "number", minimum: 0, maximum: 1, default: 0.023, description: "Linear gain of the music. 0.023 is the level of the reference ads (about 26 dB under the voice)." },
        start: num(0, "Seconds to skip at the start of the track.", { default: 0 }),
      },
    },
    captions: {
      type: "object",
      additionalProperties: false,
      description: "The karaoke caption pill (1-3 words, current word in orange).",
      properties: { enabled: { type: "boolean", default: true }, y: { type: "number", default: 1340, description: "Vertical centre of the pill in pixels." } },
    },
    scenes: { type: "array", minItems: 1, items: sceneBase, description: "The scenes, in order." },
    output: {
      type: "object",
      additionalProperties: false,
      description: "Where the results go.",
      properties: {
        upload_url: { type: "string", pattern: "^https?://", description: "The finished MP4 is sent here with an HTTP PUT (a pre-signed S3 / R2 / GCS URL works as is)." },
        thumbnail_upload_url: { type: "string", pattern: "^https?://", description: "The JPEG thumbnail is sent here with an HTTP PUT." },
        upload_method: { enum: ["PUT", "POST"], default: "PUT" },
        upload_headers: { type: "object", additionalProperties: { type: "string" }, description: "Extra headers for both uploads (for example an Authorization header)." },
        public_url: { type: "string", pattern: "^https?://", description: "The URL the video will be readable at after upload. Reported back as `video_url`." },
        thumbnail_public_url: { type: "string", pattern: "^https?://", description: "Reported back as `thumbnail_url`." },
        thumbnail_time: num(0, "Second of the video to use as the thumbnail.", { default: 1.5 }),
        loudness: { type: "number", minimum: -30, maximum: -8, default: -14, description: "Target integrated loudness in LUFS." },
      },
    },
    webhook_url: { type: "string", pattern: "^https?://", description: "POST /render only: called with the job result when the render finishes or fails." },
  },
};
writeFileSync(new URL("../schema/plan.schema.json", import.meta.url), JSON.stringify(schema, null, 2) + "\n");

const typeOf = (s) => {
  if (s.enum) return s.enum.map((e) => `\`${e}\``).join(" \\| ");
  const t = Array.isArray(s.type) ? s.type.join(" \\| ") : s.type;
  if (t === "array") {
    const it = s.items ?? {};
    const inner = it.type === "object" ? `{ ${Object.entries(it.properties).map(([k, v]) => `${k}${(it.required ?? []).includes(k) ? "" : "?"}`).join(", ")} }` : Array.isArray(it.type) ? "cue" : it.type;
    const n = s.minItems === s.maxItems && s.maxItems ? ` (${s.maxItems})` : s.maxItems ? ` (up to ${s.maxItems})` : "";
    return `${inner}[]${n}`;
  }
  if (t === "object" || t === "object \\| null") return `{ ${Object.keys(s.properties ?? {}).join(", ")} }${t.includes("null") ? " \\| null" : ""}`;
  if (t === "string \\| number") return "cue";
  if (s.anyOf) return "string \\| string[]";
  return t;
};

let md = `# Scene types

Generated from \`schema/scenes.mjs\` by \`npm run schema\`. Do not edit by hand.

Every scene in a plan looks like this:

\`\`\`json
{ "type": "pills", "start": 0, "end": 6.5, "props": { } }
\`\`\`

- **Timing.** Give \`start\` and \`end\` (seconds), or just \`duration\` and the scenes run one after another. A scene stays on screen until the next one starts; the last one runs to the end of the video.
- **Cues.** A \`cue\` says when an element appears. It is either a **word** spoken during that scene (matched by prefix against the plan's \`words\`, ignoring case and punctuation, so \`"zero"\`, \`"240"\` and \`"1on1"\` all work) or a **number of seconds** from the start of the scene. Cues in one list are matched in order. A cue that is missing or not found falls back to an even spread across the scene.
- **Highlight.** In headline text, \`*word*\` puts that word in the orange highlight box.
- **Backgrounds.** \`bg\` is \`cream\` (dot grid), \`orange\` or \`black\`. Scenes without a \`bg\` prop have a fixed background, stated in their description.
- **Safe zone.** Scenes keep everything important inside x 64–1016, y 250–1260. The caption pill sits at y ≈ 1340.
- **Text is shown in uppercase** and does not wrap unless stated, so keep lines short (about 12–16 characters for the big sizes).

| Type | What it is |
|---|---|
${Object.entries(SCENES).map(([k, d]) => `| [\`${k}\`](#${k}) | ${d.title} |`).join("\n")}
`;
for (const [type, def] of Object.entries(SCENES)) {
  md += `\n## \`${type}\`\n\n**${def.title}.** ${def.summary}\n\n| Prop | Type | Required | Default | Description |\n|---|---|---|---|---|\n`;
  for (const [k, p] of Object.entries(def.props)) {
    md += `| \`${k}\` | ${typeOf(p.schema)} | ${p.req ? "yes" : "no"} | ${p.def !== undefined ? `\`${JSON.stringify(p.def).replace(/\|/g, "\\|")}\`` : ""} | ${p.desc} |\n`;
  }
  md += `\n\`\`\`json\n${JSON.stringify({ type, duration: 4, props: def.example }, null, 2)}\n\`\`\`\n`;
}
writeFileSync(new URL("../docs/scenes.md", import.meta.url), md);
console.log(`schema/plan.schema.json and docs/scenes.md written (${Object.keys(SCENES).length} scene types)`);
