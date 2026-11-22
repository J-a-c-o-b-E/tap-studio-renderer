// Single source of truth for the scene types: `npm run schema` turns this file into
// schema/plan.schema.json (validation) and docs/scenes.md (documentation).
// When you add a scene component to src/scenes.tsx, describe it here.

const str = { type: "string", minLength: 1 };
const cue = { type: ["string", "number"] };
const bg = { enum: ["cream", "orange", "black"] };
const strs = (min, max) => ({ type: "array", items: str, minItems: min, ...(max ? { maxItems: max } : {}) });
const cues = (min, max) => ({ type: "array", items: cue, minItems: min, maxItems: max });
const item = (extra = {}, req = []) => ({ type: "object", properties: { text: str, cue, ...extra }, required: ["text", ...req], additionalProperties: false });
const items = (min, max, extra, req) => ({ type: "array", items: item(extra, req), minItems: min, maxItems: max });
const icon = { type: "string", description: "A platform (telegram, tiktok, instagram, youtube, x) or a line icon (app, store, play, user, users, tag, gift, mail, doc, globe, clock, heart, sparkle, book, images, phone, lock, flag, check)." };
const coverList = { type: "array", items: str, minItems: 1 };

const P = (schema, desc, opts = {}) => ({ schema, desc, ...opts });
const BG = (def = "cream") => P(bg, "Background style.", { def });
const TAPE = P(str, "Text of the diagonal orange ticker tape across the top. Leave out for no tape.");
const COVER = (def) => P(str, "Slideshow cover photo: a bundled name (recipe, travel, apps, gym, study, desk) or an image URL.", { def });

export const SCENES = {
  ticker: {
    title: "Ticker tape banner",
    summary: "Two diagonal tape tickers (top and bottom) scrolling the same text, with optional headline lines between them. A single tape is also available as the `tape` prop on `pills`, `strike_list` and `profile`.",
    props: {
      text: P(str, "Tape text. Use ` · ` between phrases.", { req: true }),
      lines: P(items(0, 4), "Headline lines between the tapes. `*word*` gets the orange highlight box."),
      bg: BG(),
    },
    example: { text: "0 FOLLOWERS · NO PRODUCT · NO FACE", lines: [{ text: "THIS IS", cue: 0.2 }, { text: "*FOR YOU*", cue: 0.6 }] },
  },
  pills: {
    title: "Pill list with ticks",
    summary: "Up to three black pills that pop in one by one, each with a round mark. With `flip`, each mark starts as a red cross and flips to an orange tick. Optional footer line in the highlight box.",
    props: {
      items: P(items(1, 3), "The pills. `cue` is when each one pops in.", { req: true }),
      flip: P({ type: "boolean" }, "Start each mark as a cross and flip it to a tick 0.3 s later.", { def: false }),
      foot: P(item(), "Footer line under the pills (shown in the orange highlight box)."),
      tape: TAPE,
      bg: BG(),
    },
    example: { tape: "0 FOLLOWERS · NO PRODUCT · NO FACE", flip: true, items: [{ text: "0 FOLLOWERS", cue: "zero" }, { text: "NO PRODUCT", cue: "product" }, { text: "NO FACE", cue: "face" }], foot: { text: "THIS IS FOR YOU", cue: "this" } },
  },
  checklist: {
    title: "Checklist card",
    summary: "One white card with up to four rows. `tick` rows get an orange tick and highlighted text; `cross` rows get a black cross and are struck through.",
    props: {
      items: P(items(1, 4, { kind: { enum: ["tick", "cross"] } }), "Rows. `kind` defaults to `tick`.", { req: true }),
      bg: BG(),
    },
    example: { bg: "orange", items: [{ text: "NO PRODUCT", cue: "product", kind: "cross" }, { text: "NO ADS", cue: "ads", kind: "cross" }, { text: "NO EXPERIENCE", cue: "experience", kind: "cross" }] },
  },
  strike_list: {
    title: "Strike-through list",
    summary: "Up to three white cards that pop in, then get struck through in red one after another. Optional footer line in the highlight box.",
    props: {
      items: P(items(1, 3), "The cards.", { req: true }),
      crossCue: P(cue, "When the strike-through starts.", { req: true }),
      foot: P(item(), "Footer line (orange highlight box)."),
      tape: TAPE,
      bg: BG(),
    },
    example: { items: [{ text: "DROPSHIPPING", cue: "dropshipping" }, { text: "YOUR OWN PRODUCT", cue: "product" }, { text: "PAID ADS", cue: "ads" }], crossCue: "none", foot: { text: "NONE OF IT WORKED", cue: "worked" } },
  },
  headline: {
    title: "Big headline with orange highlight box",
    summary: "One to four lines of Anton, sized to fill the width, slammed in word by word. On cream or black the last line sits in the orange highlight box; on orange the lines alternate black and white. With `flipCue`, a small stack of blocks above the headline flips upside down.",
    props: {
      lines: P(items(1, 4), "Headline lines, top to bottom.", { req: true }),
      bg: BG(),
      flipCue: P(cue, "Show a block stack above the headline and flip it over at this cue."),
      blocks: P(strs(1, 3), "Labels of the flipping blocks.", { def: ["ADS", "PRODUCT", "STORE"] }),
    },
    example: { bg: "black", lines: [{ text: "EVER", cue: "ever" }, { text: "WONDERED?", cue: "wondered" }] },
  },
  phones: {
    title: "Phone mockups row",
    summary: "A headline, three phones fanning out with slideshow covers, a platform badge popping onto each phone, and a bouncing tag underneath.",
    props: {
      head: P(str, "Headline above the phones. `*word*` is highlighted.", { req: true }),
      cues: P(cues(0, 3), "When each platform badge pops in."),
      platforms: P(strs(3, 3), "Platform badges, left to right.", { def: ["tiktok", "instagram", "youtube"] }),
      covers: P(coverList, "Cover photos for the phones (bundled names or image URLs).", { def: ["recipe", "travel", "apps"] }),
      linkCue: P(cue, "When the tag pops in."),
      tag: P(str, "Tag text.", { def: "LINK IN BIO" }),
      bg: BG(),
    },
    example: { head: "SIMPLE *SLIDESHOWS*", cues: ["tiktok", "instagram", "youtube"], linkCue: "link" },
  },
  icon_flow: {
    title: "Icon row → arrow → word",
    summary: "On black: a row of three icon cards, an arrow down to orange action pills, an arrow down to a stamped word. Without `sources` it starts with a headline instead of the icon row.",
    props: {
      sources: P(items(0, 3, { icon }, ["icon"]), "Icon cards (leave out for the headline version)."),
      head: P(str, "Headline when there are no `sources`.", { def: "THROUGH *YOUR LINK*" }),
      actions: P(items(1, 3), "Orange pills in the middle.", { req: true }),
      stampCue: P(cue, "When the word stamps in.", { req: true }),
      stamp: P(str, "The stamped word.", { def: "COMMISSION" }),
    },
    example: { sources: [{ text: "APPS", icon: "app", cue: "apps" }, { text: "TELEGRAM COMMUNITIES", icon: "telegram", cue: "telegram" }, { text: "BRANDS", icon: "store", cue: "brands" }], actions: [{ text: "JOINS", cue: "joins" }, { text: "SIGNUPS", cue: "signs" }, { text: "SALES", cue: "buys" }], stampCue: "commission" },
  },
  logo_stats: {
    title: "Logo + stat cards",
    summary: "The TAP logo tile with a one-line headline and two big stat cards (static numbers, no count-up). With `boxCue` the logo is swapped for the course box and the stat cards shrink below it.",
    props: {
      cues: P(cues(0, 3), "[logo, first stat, second stat]."),
      head: P(str, "Line under the logo.", { def: "AN AFFILIATE *NETWORK*" }),
      stats: P({ type: "array", minItems: 1, maxItems: 2, items: { type: "object", properties: { value: str, label: str }, required: ["value", "label"], additionalProperties: false } }, "The stat cards.", { def: [{ value: "240+", label: "AFFILIATES" }, { value: "110+", label: "OFFERS" }] }),
      boxCue: P(cue, "Swap the logo for the product box at this cue."),
      boxTitle: P(strs(1, 2), "Product box title lines.", { def: ["TAP AFFILIATE", "STARTER COURSE"] }),
      boxSubtitle: P(str, "Product box subtitle.", { def: "5 SHORT LESSONS" }),
      bg: BG(),
    },
    example: { cues: ["tap", "240", "110"] },
  },
  product_box: {
    title: "Product box",
    summary: "The course box (TAP mark, orange title band, subtitle). On its own it is large and centred; with `lessons` it shrinks and up to three ticked cards list underneath; with `foot` a wrapped line sits underneath.",
    props: {
      cue: P(cue, "When the box pops in."),
      title: P(strs(1, 2), "Title lines on the orange band.", { def: ["TAP AFFILIATE", "STARTER COURSE"] }),
      subtitle: P(str, "Small line at the bottom of the box.", { def: "5 SHORT LESSONS" }),
      lessons: P(items(0, 3), "Ticked cards under the box."),
      foot: P(item(), "A line under the box (use instead of `lessons`)."),
      bg: BG(),
    },
    example: { bg: "orange", cue: "course", lessons: [{ text: "FIND AN OFFER", cue: "find" }, { text: "MAKE THE POST", cue: "make" }, { text: "PUT IT LIVE", cue: "live" }] },
  },
  steps: {
    title: "Numbered steps list",
    summary: "Up to four white cards, each with an orange number tile and a line of text.",
    props: {
      items: P(items(1, 4), "The steps, in order.", { req: true }),
      bg: BG(),
    },
    example: { items: [{ text: "PICK AN OFFER", cue: "pick" }, { text: "MAKE A SLIDESHOW", cue: "make" }, { text: "POST IT", cue: "post" }] },
  },
  big_number: {
    title: "Big number + 1-on-1 card",
    summary: "A huge number on an orange tile with two words beside it (\"5 SHORT LESSONS\"), and below it a wide card with an icon, a big title and a highlighted name (\"1-ON-1 WITH JAMES\").",
    props: {
      cues: P(cues(0, 2), "[number, card]."),
      number: P(str, "The number on the tile (one or two characters).", { def: "5" }),
      lines: P(strs(1, 2), "Words beside the number.", { def: ["SHORT", "LESSONS"] }),
      card: P({ type: ["object", "null"], properties: { title: str, prefix: str, name: str, icon }, additionalProperties: false }, "The lower card. `null` hides it.", { def: { title: "1-ON-1", prefix: "WITH", name: "JAMES", icon: "telegram" } }),
      bg: BG(),
    },
    example: { bg: "black", cues: ["five", "1on1"] },
  },
  price_tag: {
    title: "Price tag",
    summary: "On orange: a white headline, then a hanging price tag drops in on a string and swings.",
    props: {
      head: P(str, "Headline above the tag.", { req: true }),
      cue: P(cue, "When the tag drops."),
      price: P(str, "Price on the tag. A leading currency symbol is drawn in orange.", { def: "$5" }),
    },
    example: { head: "ALL FOR", cue: "5" },
  },
  launch_grid: {
    title: "Launch-price grid",
    summary: "A highlighted headline, a black tag, and a 10×10 grid of member slots that fills in quickly, a few of them orange.",
    props: {
      cues: P(cues(0, 2), "[headline, tag]."),
      head: P(str, "Headline.", { def: "*LAUNCH PRICE*" }),
      tag: P(str, "Tag text.", { def: "FIRST 100 MEMBERS" }),
      filled: P({ type: "array", items: { type: "integer", minimum: 0, maximum: 99 } }, "Indexes (0–99) of the orange slots.", { def: [2, 5, 11, 17, 23, 30, 38, 41, 52] }),
      bg: BG(),
    },
    example: { cues: ["launch", "100"] },
  },
  clock: {
    title: "Clock",
    summary: "On black: a ticking clock and two lines, the second one huge.",
    props: {
      cue: P(cue, "When the lines slam in."),
      lines: P(strs(1, 2), "The two lines.", { def: ["THERE'S STILL", "*TIME*"] }),
    },
    example: { cue: "still" },
  },
  cta: {
    title: "Final CTA card",
    summary: "The end card: TAP logo, two headline lines, a black button with the price in an orange block, and three bouncing arrows pointing down. Keep it on screen at least 1.5 s after the last word.",
    props: {
      cue: P(cue, "When the button pops in."),
      lines: P(strs(1, 2), "Headline lines.", { def: ["LEARN *AFFILIATE*", "MARKETING"] }),
      button: P(str, "Button text.", { def: "GET STARTED –" }),
      price: P({ type: ["string", "null"] }, "Price block on the button. `null` hides it.", { def: "$5" }),
      bg: BG(),
    },
    example: { cue: "click" },
  },
  block_stack: {
    title: "Block stack that falls over",
    summary: "On black: a small white tag, a huge headline, and three blocks that drop into a stack, wobble and fall over.",
    props: {
      kicker: P(str, "Small tag at the top."),
      head: P(str, "Headline (wraps onto two lines).", { req: true }),
      headCue: P(cue, "When the headline slams in."),
      blocks: P(items(1, 3), "Blocks, bottom to top. The top one is orange.", { req: true }),
      fallCue: P(cue, "When the stack falls.", { req: true }),
    },
    example: { kicker: "WHAT EVERYONE TELLS YOU", head: "BUILD *FIRST*", headCue: "build", blocks: [{ text: "STORE", cue: "store" }, { text: "PRODUCT", cue: "product" }, { text: "ADS", cue: "ads" }], fallCue: "backwards" },
  },
  have_need: {
    title: "They have / they need",
    summary: "A row of three icon cards, then a black card (\"THEY HAVE · THE PRODUCT\") and an orange card (\"THEY NEED · CUSTOMERS\") with a row of people popping in.",
    props: {
      cues: P(cues(0, 5), "[icon 1, icon 2, icon 3, have card, need card]."),
      icons: P({ type: "array", minItems: 3, maxItems: 3, items: { type: "object", properties: { icon, text: str }, required: ["icon", "text"], additionalProperties: false } }, "The icon cards.", { def: [{ icon: "app", text: "APPS" }, { icon: "telegram", text: "TELEGRAM" }, { icon: "store", text: "BRANDS" }] }),
      have: P({ type: "object", properties: { label: str, text: str }, additionalProperties: false }, "The black card.", { def: { label: "THEY HAVE", text: "THE PRODUCT" } }),
      need: P({ type: "object", properties: { label: str, text: str }, additionalProperties: false }, "The orange card.", { def: { label: "THEY NEED", text: "CUSTOMERS" } }),
      bg: BG(),
    },
    example: { cues: ["apps", "telegram", "brands", "product", "customers"] },
  },
  walk: {
    title: "People walking to a brand",
    summary: "On black: a phone on the left, a brand card on the right, people walking from one to the other, an orange tag on top and a stamped word below.",
    props: {
      cues: P(cues(0, 2), "[stamp, tag]."),
      tag: P(str, "Orange tag at the top.", { def: "FOR EVERY PERSON YOU SEND" }),
      label: P(str, "Label on the right-hand card.", { def: "BRAND" }),
      icon: P(str, "Line icon on the right-hand card.", { def: "store" }),
      stamp: P(str, "The stamped word.", { def: "COMMISSION" }),
      cover: COVER("travel"),
    },
    example: { cues: ["commission", "every"] },
  },
  swipe_phone: {
    title: "Swiping phone",
    summary: "On orange: one large phone swiping through slideshow covers, a white tag at the top left and a bouncing black tag at the bottom right.",
    props: {
      cues: P(cues(0, 2), "[top tag, bottom tag]."),
      tag: P(str, "Top tag.", { def: "SIMPLE SLIDESHOWS" }),
      linkTag: P(str, "Bottom tag.", { def: "LINK IN BIO" }),
      covers: P(coverList, "Covers to swipe through.", { def: ["recipe", "travel", "apps", "gym", "study", "desk"] }),
    },
    example: { cues: ["slideshows", "link"] },
  },
  profile: {
    title: "New profile on a phone",
    summary: "A phone showing a blank new profile: platform badge, an orange badge (\"1 FOLLOWER\") and four posts dropping into a grid.",
    props: {
      cues: P(cues(0, 3), "[platform badge, orange badge, posts]."),
      badge: P(str, "Text of the orange badge.", { def: "1 FOLLOWER" }),
      platform: P(str, "Platform badge.", { def: "tiktok" }),
      covers: P(coverList, "The four posts.", { def: ["recipe", "travel", "gym", "study"] }),
      tape: TAPE,
      bg: BG(),
    },
    example: { tape: "0 FOLLOWERS · NO PRODUCT · NO FACE", cues: ["tiktok", "follower", "four"] },
  },
  views: {
    title: "Views card",
    summary: "On black: a post with an orange frame, a white card with a views figure, and a stamped word.",
    props: {
      cues: P(cues(0, 2), "[views card, stamp]."),
      text: P(str, "Text on the card.", { def: "1.9K VIEWS" }),
      stamp: P(str, "The stamped word.", { def: "NOT VIRAL" }),
      cover: COVER("recipe"),
    },
    example: { cues: ["1900", "viral"] },
  },
  result_card: {
    title: "Result card",
    summary: "On orange: a small white headline and a large white card with a big tick and two lines.",
    props: {
      cue: P(cue, "When the card pops in."),
      head: P(str, "Small headline.", { def: "AND IT STILL BROUGHT IN" }),
      lines: P(strs(1, 2), "Card lines (first one larger).", { def: ["1 PAID", "CONVERSION"] }),
    },
    example: { cue: "paid" },
  },
  fan_out: {
    title: "Fan-out of people",
    summary: "Two headline lines, a post in the middle and two rings of people fanning out from it (a small black ring, then a large orange one).",
    props: {
      cues: P(cues(0, 3), "[headline, inner ring, outer ring]."),
      lines: P(strs(1, 2), "Headline lines.", { def: ["FOLLOWERS", "*DON'T MATTER*"] }),
      cover: COVER("recipe"),
      bg: BG(),
    },
    example: { cues: ["followers", "holds", "shown"] },
  },
};

export const COMMON = { str, cue, bg };
