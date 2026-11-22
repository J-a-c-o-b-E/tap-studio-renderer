---
name: safety
description: Rules every TAP video must pass before it is rendered or handed in (Meta ad policy, claims, brand). Load at the start of every job.
---

# Safety

TAP ads were rejected by Meta for "investment" content and for "recruiting with false claims". Every video follows these rules unless the job says `"compliance": "standard"`. Even then, the claim rules still apply.

## Never (meta_safe)

- **Earnings.** No promise or hint of income: "make money", "earn", "passive income", "first $1,000", "until you make", "get rich", "quit your job", "financial freedom", "guaranteed".
- **Amounts.** The only amount anywhere (voice, captions, on screen) is the product's own `price`. No payouts, no commissions in dollars, no "per sale" figures, no view-to-money maths.
- **Money visuals.** No cash, coins, wallets, charts, rising arrows, counters or progress bars toward money, payout notifications, dashboards with money. This applies to AI footage too: say so in the prompt ("no money, no charts, no screens showing numbers").
- **Finance words.** forex, trading, signals, crypto, bitcoin, investment, invest, gold, profit.
- **Recruiting.** "I need more people", "more offers than affiliates", urgency about joining a team.
- **The word "intern".** Say "affiliate".
- **Fake proof.** No invented testimonials, names, screenshots, reviews, follower counts or results. A reaction clip shows a feeling, not a claim: the person never holds up earnings or says a figure.

## Always

- State only facts given in `job.product.facts`, `job.brief` or the job's script. If you are unsure whether something is true or allowed, leave it out.
- "Commission" as a word is fine. Counts that are not money are fine when the job gives them ("240+ affiliates", "5 lessons").
- People in AI footage are adults, shown in ordinary settings, and are not real or recognisable people. Never name or imitate a real person or a brand that is not TAP.
- Platform logos only as the renderer draws them (the badges in `phones`, `profile`, `icon_flow`).

## How to check

- `safety_check` on the script before you make the voiceover (it costs money to redo).
- `validate_plan` reports `safety_findings` for the plan and the caption words. Fix every finding: reword, do not disguise.
- Look at frames of AI footage before you build on it. If a clip shows money, a chart, readable fake numbers or anything off, do not use it.
