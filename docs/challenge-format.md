# Challenge format

Organisers write their challenge list wherever they like (notes app, WhatsApp, a doc) and paste it into the admin setup page. There is one way to write each part, so the example teaches the whole format. A line written another way gets an error that shows the right form. The preview shows the result before anything is saved.

## Example

```md
# Around town

- Make a birthday card [5-20]
  Judged on effort. A napkin counts, but barely.
- Pick up a free item from Marktplaats and deliver it by bike [30-100]
  Bigger and more awkward scores higher.
- Swim in a fountain [25]

# Food

- Get a free dessert from a restaurant [10-15]
- Eat something you have never tried [5-10]
```

## Rules

- **A challenge** is a line starting with `- `. Other list markers (`*`, `+`, `•`, `1.`, `1)`) are an error, unless they are indented under a challenge as part of its description. So is a line that ends in points but starts with a dash and no space (`-Run [5]`) or with an en or em dash (`– Run [5]`).
- **Points** go at the end of the line in square brackets, as whole numbers up to 100000: `[10]` for a fixed score or `[5-20]` for a range. Spaces inside the brackets and an en or em dash (`[5 – 20]` or `[5—20]`, which phones often type) are fine. Other forms, like `(10)` or `10 pts`, are an error.
- **A description** is any indented or plain line directly under a challenge, up to the next list item or heading.
- **A section** is a line starting with `# `. Challenges below it belong to that section. Sections are optional. `##` and deeper headings are an error.
- Blank lines are ignored.

## Preview and errors

Before saving, the admin sees a table of what was parsed: section, title, points, description. Lines that could not be parsed are highlighted with the reason (for example "no points found", or "min is greater than max"). Nothing is saved until the admin confirms.

## Re-importing

Pasting again replaces the challenge list. Challenges are matched by title, ignoring case, surrounding spaces and repeated spaces.

- **Matched**: title, section, description, range and position are updated, so a title pasted in other case or spacing replaces the stored one. Scored claims are clamped to the new range. The preview marks a matched challenge "Updated" only when its title, section, description or points change, and says when the order changes.
- **New**: added.
- **Missing, without claims**: deleted.
- **Missing, with claims**: the preview lists them with their claim count. Confirming deletes them and their claims.

To fix a typo in the title of a challenge that already has claims, edit that challenge in place instead of re-importing.

Two challenges whose titles match this way are a parse error.
