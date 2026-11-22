# Scene types

Generated from `schema/scenes.mjs` by `npm run schema`. Do not edit by hand.

Every scene in a plan looks like this:

```json
{ "type": "pills", "start": 0, "end": 6.5, "props": { } }
```

- **Timing.** Give `start` and `end` (seconds), or just `duration` and the scenes run one after another. A scene stays on screen until the next one starts; the last one runs to the end of the video.
- **Cues.** A `cue` says when an element appears. It is either a **word** spoken during that scene (matched by prefix against the plan's `words`, ignoring case and punctuation, so `"zero"`, `"240"` and `"1on1"` all work) or a **number of seconds** from the start of the scene. Cues in one list are matched in order. A cue that is missing or not found falls back to an even spread across the scene.
- **Highlight.** In headline text, `*word*` puts that word in the orange highlight box.
- **Backgrounds.** `bg` is `cream` (dot grid), `orange` or `black`. Scenes without a `bg` prop have a fixed background, stated in their description.
- **Safe zone.** Scenes keep everything important inside x 64–1016, y 250–1260. The caption pill sits at y ≈ 1340.
- **Text is shown in uppercase** and does not wrap unless stated, so keep lines short (about 12–16 characters for the big sizes).

| Type | What it is |
|---|---|
| [`footage`](#footage) | Video footage |
| [`ticker`](#ticker) | Ticker tape banner |
| [`pills`](#pills) | Pill list with ticks |
| [`checklist`](#checklist) | Checklist card |
| [`strike_list`](#strike_list) | Strike-through list |
| [`headline`](#headline) | Big headline with orange highlight box |
| [`phones`](#phones) | Phone mockups row |
| [`icon_flow`](#icon_flow) | Icon row → arrow → word |
| [`logo_stats`](#logo_stats) | Logo + stat cards |
| [`product_box`](#product_box) | Product box |
| [`steps`](#steps) | Numbered steps list |
| [`big_number`](#big_number) | Big number + 1-on-1 card |
| [`price_tag`](#price_tag) | Price tag |
| [`launch_grid`](#launch_grid) | Launch-price grid |
| [`clock`](#clock) | Clock |
| [`cta`](#cta) | Final CTA card |
| [`block_stack`](#block_stack) | Block stack that falls over |
| [`have_need`](#have_need) | They have / they need |
| [`walk`](#walk) | People walking to a brand |
| [`swipe_phone`](#swipe_phone) | Swiping phone |
| [`profile`](#profile) | New profile on a phone |
| [`views`](#views) | Views card |
| [`result_card`](#result_card) | Result card |
| [`fan_out`](#fan_out) | Fan-out of people |

## `footage`

**Video footage.** A video clip played full-frame (AI footage, a reaction clip, a song video), with an optional orange tag and white headline at the top over a soft dark gradient. The caption pill runs on top as on every scene. The clip's own sound is off unless `volume` is set.

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `url` | string | yes |  | The clip: an http(s) URL, or (CLI only) a file path relative to the plan file. MP4 (H.264) or MOV. |
| `startFrom` | number | no | `0` | Seconds to skip at the start of the clip. |
| `clipSeconds` | number | no |  | Length of the clip in seconds. Set it when the scene is longer than the clip, so the clip loops instead of running out. |
| `volume` | number | no | `0` | Volume of the clip's own sound (0 = muted). |
| `fit` | `cover` \| `contain` | no | `"cover"` | How the clip fills the 9:16 frame. |
| `dim` | number | no | `0` | Darken the whole clip by this much. |
| `tag` | string | no |  | Orange tag at the top. |
| `tagCue` | cue | no |  | When the tag pops in. |
| `head` | string \| string[] | no |  | White headline line(s) under the tag. `*word*` gets the orange highlight box. |
| `headCue` | cue | no |  | When the headline slams in. |

```json
{
  "type": "footage",
  "duration": 4,
  "props": {
    "url": "https://cdn.example.com/clips/reaction.mp4",
    "clipSeconds": 5,
    "tag": "POV",
    "head": [
      "YOUR FIRST",
      "*COMMISSION*"
    ],
    "headCue": 0.4
  }
}
```

## `ticker`

**Ticker tape banner.** Two diagonal tape tickers (top and bottom) scrolling the same text, with optional headline lines between them. A single tape is also available as the `tape` prop on `pills`, `strike_list` and `profile`.

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `text` | string | yes |  | Tape text. Use ` · ` between phrases. |
| `lines` | { text, cue? }[] (up to 4) | no |  | Headline lines between the tapes. `*word*` gets the orange highlight box. |
| `bg` | `cream` \| `orange` \| `black` | no | `"cream"` | Background style. |

```json
{
  "type": "ticker",
  "duration": 4,
  "props": {
    "text": "0 FOLLOWERS · NO PRODUCT · NO FACE",
    "lines": [
      {
        "text": "THIS IS",
        "cue": 0.2
      },
      {
        "text": "*FOR YOU*",
        "cue": 0.6
      }
    ]
  }
}
```

## `pills`

**Pill list with ticks.** Up to three black pills that pop in one by one, each with a round mark. With `flip`, each mark starts as a red cross and flips to an orange tick. Optional footer line in the highlight box.

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `items` | { text, cue? }[] (up to 3) | yes |  | The pills. `cue` is when each one pops in. |
| `flip` | boolean | no | `false` | Start each mark as a cross and flip it to a tick 0.3 s later. |
| `foot` | { text, cue } | no |  | Footer line under the pills (shown in the orange highlight box). |
| `tape` | string | no |  | Text of the diagonal orange ticker tape across the top. Leave out for no tape. |
| `bg` | `cream` \| `orange` \| `black` | no | `"cream"` | Background style. |

```json
{
  "type": "pills",
  "duration": 4,
  "props": {
    "tape": "0 FOLLOWERS · NO PRODUCT · NO FACE",
    "flip": true,
    "items": [
      {
        "text": "0 FOLLOWERS",
        "cue": "zero"
      },
      {
        "text": "NO PRODUCT",
        "cue": "product"
      },
      {
        "text": "NO FACE",
        "cue": "face"
      }
    ],
    "foot": {
      "text": "THIS IS FOR YOU",
      "cue": "this"
    }
  }
}
```

## `checklist`

**Checklist card.** One white card with up to four rows. `tick` rows get an orange tick and highlighted text; `cross` rows get a black cross and are struck through.

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `items` | { text, cue?, kind? }[] (up to 4) | yes |  | Rows. `kind` defaults to `tick`. |
| `bg` | `cream` \| `orange` \| `black` | no | `"cream"` | Background style. |

```json
{
  "type": "checklist",
  "duration": 4,
  "props": {
    "bg": "orange",
    "items": [
      {
        "text": "NO PRODUCT",
        "cue": "product",
        "kind": "cross"
      },
      {
        "text": "NO ADS",
        "cue": "ads",
        "kind": "cross"
      },
      {
        "text": "NO EXPERIENCE",
        "cue": "experience",
        "kind": "cross"
      }
    ]
  }
}
```

## `strike_list`

**Strike-through list.** Up to three white cards that pop in, then get struck through in red one after another. Optional footer line in the highlight box.

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `items` | { text, cue? }[] (up to 3) | yes |  | The cards. |
| `crossCue` | cue | yes |  | When the strike-through starts. |
| `foot` | { text, cue } | no |  | Footer line (orange highlight box). |
| `tape` | string | no |  | Text of the diagonal orange ticker tape across the top. Leave out for no tape. |
| `bg` | `cream` \| `orange` \| `black` | no | `"cream"` | Background style. |

```json
{
  "type": "strike_list",
  "duration": 4,
  "props": {
    "items": [
      {
        "text": "DROPSHIPPING",
        "cue": "dropshipping"
      },
      {
        "text": "YOUR OWN PRODUCT",
        "cue": "product"
      },
      {
        "text": "PAID ADS",
        "cue": "ads"
      }
    ],
    "crossCue": "none",
    "foot": {
      "text": "NONE OF IT WORKED",
      "cue": "worked"
    }
  }
}
```

## `headline`

**Big headline with orange highlight box.** One to four lines of Anton, sized to fill the width, slammed in word by word. On cream or black the last line sits in the orange highlight box; on orange the lines alternate black and white. With `flipCue`, a small stack of blocks above the headline flips upside down.

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `lines` | { text, cue? }[] (up to 4) | yes |  | Headline lines, top to bottom. |
| `bg` | `cream` \| `orange` \| `black` | no | `"cream"` | Background style. |
| `flipCue` | cue | no |  | Show a block stack above the headline and flip it over at this cue. |
| `blocks` | string[] (up to 3) | no | `["ADS","PRODUCT","STORE"]` | Labels of the flipping blocks. |

```json
{
  "type": "headline",
  "duration": 4,
  "props": {
    "bg": "black",
    "lines": [
      {
        "text": "EVER",
        "cue": "ever"
      },
      {
        "text": "WONDERED?",
        "cue": "wondered"
      }
    ]
  }
}
```

## `phones`

**Phone mockups row.** A headline, three phones fanning out with slideshow covers, a platform badge popping onto each phone, and a bouncing tag underneath.

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `head` | string | yes |  | Headline above the phones. `*word*` is highlighted. |
| `cues` | cue[] (up to 3) | no |  | When each platform badge pops in. |
| `platforms` | string[] (3) | no | `["tiktok","instagram","youtube"]` | Platform badges, left to right. |
| `covers` | string[] | no | `["recipe","travel","apps"]` | Cover photos for the phones (bundled names or image URLs). |
| `linkCue` | cue | no |  | When the tag pops in. |
| `tag` | string | no | `"LINK IN BIO"` | Tag text. |
| `bg` | `cream` \| `orange` \| `black` | no | `"cream"` | Background style. |

```json
{
  "type": "phones",
  "duration": 4,
  "props": {
    "head": "SIMPLE *SLIDESHOWS*",
    "cues": [
      "tiktok",
      "instagram",
      "youtube"
    ],
    "linkCue": "link"
  }
}
```

## `icon_flow`

**Icon row → arrow → word.** On black: a row of three icon cards, an arrow down to orange action pills, an arrow down to a stamped word. Without `sources` it starts with a headline instead of the icon row.

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `sources` | { text, cue?, icon }[] (up to 3) | no |  | Icon cards (leave out for the headline version). |
| `head` | string | no | `"THROUGH *YOUR LINK*"` | Headline when there are no `sources`. |
| `actions` | { text, cue? }[] (up to 3) | yes |  | Orange pills in the middle. |
| `stampCue` | cue | yes |  | When the word stamps in. |
| `stamp` | string | no | `"COMMISSION"` | The stamped word. |

```json
{
  "type": "icon_flow",
  "duration": 4,
  "props": {
    "sources": [
      {
        "text": "APPS",
        "icon": "app",
        "cue": "apps"
      },
      {
        "text": "TELEGRAM COMMUNITIES",
        "icon": "telegram",
        "cue": "telegram"
      },
      {
        "text": "BRANDS",
        "icon": "store",
        "cue": "brands"
      }
    ],
    "actions": [
      {
        "text": "JOINS",
        "cue": "joins"
      },
      {
        "text": "SIGNUPS",
        "cue": "signs"
      },
      {
        "text": "SALES",
        "cue": "buys"
      }
    ],
    "stampCue": "commission"
  }
}
```

## `logo_stats`

**Logo + stat cards.** The TAP logo tile with a one-line headline and two big stat cards (static numbers, no count-up). With `boxCue` the logo is swapped for the course box and the stat cards shrink below it.

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `cues` | cue[] (up to 3) | no |  | [logo, first stat, second stat]. |
| `head` | string | no | `"AN AFFILIATE *NETWORK*"` | Line under the logo. |
| `stats` | { value, label }[] (up to 2) | no | `[{"value":"240+","label":"AFFILIATES"},{"value":"110+","label":"OFFERS"}]` | The stat cards. |
| `boxCue` | cue | no |  | Swap the logo for the product box at this cue. |
| `boxTitle` | string[] (up to 2) | no | `["TAP AFFILIATE","STARTER COURSE"]` | Product box title lines. |
| `boxSubtitle` | string | no | `"5 SHORT LESSONS"` | Product box subtitle. |
| `bg` | `cream` \| `orange` \| `black` | no | `"cream"` | Background style. |

```json
{
  "type": "logo_stats",
  "duration": 4,
  "props": {
    "cues": [
      "tap",
      "240",
      "110"
    ]
  }
}
```

## `product_box`

**Product box.** The course box (TAP mark, orange title band, subtitle). On its own it is large and centred; with `lessons` it shrinks and up to three ticked cards list underneath; with `foot` a wrapped line sits underneath.

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `cue` | cue | no |  | When the box pops in. |
| `title` | string[] (up to 2) | no | `["TAP AFFILIATE","STARTER COURSE"]` | Title lines on the orange band. |
| `subtitle` | string | no | `"5 SHORT LESSONS"` | Small line at the bottom of the box. |
| `lessons` | { text, cue? }[] (up to 3) | no |  | Ticked cards under the box. |
| `foot` | { text, cue } | no |  | A line under the box (use instead of `lessons`). |
| `bg` | `cream` \| `orange` \| `black` | no | `"cream"` | Background style. |

```json
{
  "type": "product_box",
  "duration": 4,
  "props": {
    "bg": "orange",
    "cue": "course",
    "lessons": [
      {
        "text": "FIND AN OFFER",
        "cue": "find"
      },
      {
        "text": "MAKE THE POST",
        "cue": "make"
      },
      {
        "text": "PUT IT LIVE",
        "cue": "live"
      }
    ]
  }
}
```

## `steps`

**Numbered steps list.** Up to four white cards, each with an orange number tile and a line of text.

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `items` | { text, cue? }[] (up to 4) | yes |  | The steps, in order. |
| `bg` | `cream` \| `orange` \| `black` | no | `"cream"` | Background style. |

```json
{
  "type": "steps",
  "duration": 4,
  "props": {
    "items": [
      {
        "text": "PICK AN OFFER",
        "cue": "pick"
      },
      {
        "text": "MAKE A SLIDESHOW",
        "cue": "make"
      },
      {
        "text": "POST IT",
        "cue": "post"
      }
    ]
  }
}
```

## `big_number`

**Big number + 1-on-1 card.** A huge number on an orange tile with two words beside it ("5 SHORT LESSONS"), and below it a wide card with an icon, a big title and a highlighted name ("1-ON-1 WITH JAMES").

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `cues` | cue[] (up to 2) | no |  | [number, card]. |
| `number` | string | no | `"5"` | The number on the tile (one or two characters). |
| `lines` | string[] (up to 2) | no | `["SHORT","LESSONS"]` | Words beside the number. |
| `card` | { title, prefix, name, icon } \| null | no | `{"title":"1-ON-1","prefix":"WITH","name":"JAMES","icon":"telegram"}` | The lower card. `null` hides it. |
| `bg` | `cream` \| `orange` \| `black` | no | `"cream"` | Background style. |

```json
{
  "type": "big_number",
  "duration": 4,
  "props": {
    "bg": "black",
    "cues": [
      "five",
      "1on1"
    ]
  }
}
```

## `price_tag`

**Price tag.** On orange: a white headline, then a hanging price tag drops in on a string and swings.

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `head` | string | yes |  | Headline above the tag. |
| `cue` | cue | no |  | When the tag drops. |
| `price` | string | no | `"$5"` | Price on the tag. A leading currency symbol is drawn in orange. |

```json
{
  "type": "price_tag",
  "duration": 4,
  "props": {
    "head": "ALL FOR",
    "cue": "5"
  }
}
```

## `launch_grid`

**Launch-price grid.** A highlighted headline, a black tag, and a 10×10 grid of member slots that fills in quickly, a few of them orange.

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `cues` | cue[] (up to 2) | no |  | [headline, tag]. |
| `head` | string | no | `"*LAUNCH PRICE*"` | Headline. |
| `tag` | string | no | `"FIRST 100 MEMBERS"` | Tag text. |
| `filled` | integer[] | no | `[2,5,11,17,23,30,38,41,52]` | Indexes (0–99) of the orange slots. |
| `bg` | `cream` \| `orange` \| `black` | no | `"cream"` | Background style. |

```json
{
  "type": "launch_grid",
  "duration": 4,
  "props": {
    "cues": [
      "launch",
      "100"
    ]
  }
}
```

## `clock`

**Clock.** On black: a ticking clock and two lines, the second one huge.

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `cue` | cue | no |  | When the lines slam in. |
| `lines` | string[] (up to 2) | no | `["THERE'S STILL","*TIME*"]` | The two lines. |

```json
{
  "type": "clock",
  "duration": 4,
  "props": {
    "cue": "still"
  }
}
```

## `cta`

**Final CTA card.** The end card: TAP logo, two headline lines, a black button with the price in an orange block, and three bouncing arrows pointing down. Keep it on screen at least 1.5 s after the last word.

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `cue` | cue | no |  | When the button pops in. |
| `lines` | string[] (up to 2) | no | `["LEARN *AFFILIATE*","MARKETING"]` | Headline lines. |
| `button` | string | no | `"GET STARTED –"` | Button text. |
| `price` | string \| null | no | `"$5"` | Price block on the button. `null` hides it. |
| `bg` | `cream` \| `orange` \| `black` | no | `"cream"` | Background style. |

```json
{
  "type": "cta",
  "duration": 4,
  "props": {
    "cue": "click"
  }
}
```

## `block_stack`

**Block stack that falls over.** On black: a small white tag, a huge headline, and three blocks that drop into a stack, wobble and fall over.

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `kicker` | string | no |  | Small tag at the top. |
| `head` | string | yes |  | Headline (wraps onto two lines). |
| `headCue` | cue | no |  | When the headline slams in. |
| `blocks` | { text, cue? }[] (up to 3) | yes |  | Blocks, bottom to top. The top one is orange. |
| `fallCue` | cue | yes |  | When the stack falls. |

```json
{
  "type": "block_stack",
  "duration": 4,
  "props": {
    "kicker": "WHAT EVERYONE TELLS YOU",
    "head": "BUILD *FIRST*",
    "headCue": "build",
    "blocks": [
      {
        "text": "STORE",
        "cue": "store"
      },
      {
        "text": "PRODUCT",
        "cue": "product"
      },
      {
        "text": "ADS",
        "cue": "ads"
      }
    ],
    "fallCue": "backwards"
  }
}
```

## `have_need`

**They have / they need.** A row of three icon cards, then a black card ("THEY HAVE · THE PRODUCT") and an orange card ("THEY NEED · CUSTOMERS") with a row of people popping in.

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `cues` | cue[] (up to 5) | no |  | [icon 1, icon 2, icon 3, have card, need card]. |
| `icons` | { icon, text }[] (3) | no | `[{"icon":"app","text":"APPS"},{"icon":"telegram","text":"TELEGRAM"},{"icon":"store","text":"BRANDS"}]` | The icon cards. |
| `have` | { label, text } | no | `{"label":"THEY HAVE","text":"THE PRODUCT"}` | The black card. |
| `need` | { label, text } | no | `{"label":"THEY NEED","text":"CUSTOMERS"}` | The orange card. |
| `bg` | `cream` \| `orange` \| `black` | no | `"cream"` | Background style. |

```json
{
  "type": "have_need",
  "duration": 4,
  "props": {
    "cues": [
      "apps",
      "telegram",
      "brands",
      "product",
      "customers"
    ]
  }
}
```

## `walk`

**People walking to a brand.** On black: a phone on the left, a brand card on the right, people walking from one to the other, an orange tag on top and a stamped word below.

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `cues` | cue[] (up to 2) | no |  | [stamp, tag]. |
| `tag` | string | no | `"FOR EVERY PERSON YOU SEND"` | Orange tag at the top. |
| `label` | string | no | `"BRAND"` | Label on the right-hand card. |
| `icon` | string | no | `"store"` | Line icon on the right-hand card. |
| `stamp` | string | no | `"COMMISSION"` | The stamped word. |
| `cover` | string | no | `"travel"` | Slideshow cover photo: a bundled name (recipe, travel, apps, gym, study, desk) or an image URL. |

```json
{
  "type": "walk",
  "duration": 4,
  "props": {
    "cues": [
      "commission",
      "every"
    ]
  }
}
```

## `swipe_phone`

**Swiping phone.** On orange: one large phone swiping through slideshow covers, a white tag at the top left and a bouncing black tag at the bottom right.

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `cues` | cue[] (up to 2) | no |  | [top tag, bottom tag]. |
| `tag` | string | no | `"SIMPLE SLIDESHOWS"` | Top tag. |
| `linkTag` | string | no | `"LINK IN BIO"` | Bottom tag. |
| `covers` | string[] | no | `["recipe","travel","apps","gym","study","desk"]` | Covers to swipe through. |

```json
{
  "type": "swipe_phone",
  "duration": 4,
  "props": {
    "cues": [
      "slideshows",
      "link"
    ]
  }
}
```

## `profile`

**New profile on a phone.** A phone showing a blank new profile: platform badge, an orange badge ("1 FOLLOWER") and four posts dropping into a grid.

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `cues` | cue[] (up to 3) | no |  | [platform badge, orange badge, posts]. |
| `badge` | string | no | `"1 FOLLOWER"` | Text of the orange badge. |
| `platform` | string | no | `"tiktok"` | Platform badge. |
| `covers` | string[] | no | `["recipe","travel","gym","study"]` | The four posts. |
| `tape` | string | no |  | Text of the diagonal orange ticker tape across the top. Leave out for no tape. |
| `bg` | `cream` \| `orange` \| `black` | no | `"cream"` | Background style. |

```json
{
  "type": "profile",
  "duration": 4,
  "props": {
    "tape": "0 FOLLOWERS · NO PRODUCT · NO FACE",
    "cues": [
      "tiktok",
      "follower",
      "four"
    ]
  }
}
```

## `views`

**Views card.** On black: a post with an orange frame, a white card with a views figure, and a stamped word.

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `cues` | cue[] (up to 2) | no |  | [views card, stamp]. |
| `text` | string | no | `"1.9K VIEWS"` | Text on the card. |
| `stamp` | string | no | `"NOT VIRAL"` | The stamped word. |
| `cover` | string | no | `"recipe"` | Slideshow cover photo: a bundled name (recipe, travel, apps, gym, study, desk) or an image URL. |

```json
{
  "type": "views",
  "duration": 4,
  "props": {
    "cues": [
      "1900",
      "viral"
    ]
  }
}
```

## `result_card`

**Result card.** On orange: a small white headline and a large white card with a big tick and two lines.

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `cue` | cue | no |  | When the card pops in. |
| `head` | string | no | `"AND IT STILL BROUGHT IN"` | Small headline. |
| `lines` | string[] (up to 2) | no | `["1 PAID","CONVERSION"]` | Card lines (first one larger). |

```json
{
  "type": "result_card",
  "duration": 4,
  "props": {
    "cue": "paid"
  }
}
```

## `fan_out`

**Fan-out of people.** Two headline lines, a post in the middle and two rings of people fanning out from it (a small black ring, then a large orange one).

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `cues` | cue[] (up to 3) | no |  | [headline, inner ring, outer ring]. |
| `lines` | string[] (up to 2) | no | `["FOLLOWERS","*DON'T MATTER*"]` | Headline lines. |
| `cover` | string | no | `"recipe"` | Slideshow cover photo: a bundled name (recipe, travel, apps, gym, study, desk) or an image URL. |
| `bg` | `cream` \| `orange` \| `black` | no | `"cream"` | Background style. |

```json
{
  "type": "fan_out",
  "duration": 4,
  "props": {
    "cues": [
      "followers",
      "holds",
      "shown"
    ]
  }
}
```
