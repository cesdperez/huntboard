# Challenge format

Organisers write their challenge list wherever they like (notes app, WhatsApp, a doc) and paste it into the admin setup page. The parser is lenient: it accepts the way people write lists naturally, then shows a preview before anything is saved.

## Example

```md
# Around town

- Make a birthday card [5-20]
  Judged on effort. A napkin counts, but barely.
- Pick up a free item from Marktplaats and deliver it by bike [30-100]
  Bigger and more awkward scores higher.
- Swim in a fountain [25]

# Food

- Get a free dessert from a restaurant (10-15)
- Eat something you have never tried: 5-10 pts
```

## Rules

- **A challenge** is a list item: a line starting with `-`, `*`, `+` or a number (`1.`, `1)`).
- **Points** go at the end of the line, as a range or a single value of whole numbers. A single value means min and max are the same. Accepted forms:
  - `[5-20]`, `(5-20)`, `[10]`, `(10)`
  - `5-20 pts`, `10 points`, `: 5-20`
  - En dashes and spaces around the dash are fine: `[5 – 20]`.
- **A description** is any indented or plain line directly under a challenge, up to the next list item or heading.
- **A section** is a markdown heading (`#`, `##`, ...). Challenges below it belong to that section. Sections are optional.
- Blank lines are ignored.

## Preview and errors

Before saving, the admin sees a table of what was parsed: section, title, points, description. Lines that could not be parsed are highlighted with the reason (for example "no points found", or "min is greater than max"). Nothing is saved until the admin confirms.

## Re-importing

Pasting again replaces the challenge list. Challenges are matched by title, ignoring case and surrounding spaces.

- **Matched**: section, description, range and position are updated. Scored claims are clamped to the new range.
- **New**: added.
- **Missing, without claims**: deleted.
- **Missing, with claims**: the preview lists them with their claim count. Confirming deletes them and their claims.

To fix a typo in the title of a challenge that already has claims, edit that challenge in place instead of re-importing.

Two challenges with the same title are a parse error.
