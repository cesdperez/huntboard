# Design

Huntboard is used on a phone, outdoors, in a hurry, often one-handed while the other hand holds a bike or a drink. The organiser judges between WhatsApp messages. Every screen is designed for a 390px wide phone first and grows from there.

## Direction: the control flag

Orienteering marks each checkpoint with a square flag split diagonally into orange and white. It is the most recognisable object in the world of finding things around a city, and the diagonal split is our one signature. It appears in exactly one place: the claim marker. Everything else stays quiet so the marker and the numbers carry the screen.

The palette is signal orange on a cool white, with deep navy for text. Orange is also the Dutch colour, which suits the reference event without naming it.

## Color

Defined as CSS custom properties on `:root`, with a dark set under `prefers-color-scheme: dark`. The hunt runs from afternoon into evening, so dark mode is a first-class theme, not an afterthought.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#F5F7FA` | `#0F1A30` | Page background |
| `--surface` | `#FFFFFF` | `#17233D` | Sheets, rows, inputs |
| `--ink` | `#14213D` | `#EEF1F6` | Text, outlines, icons |
| `--muted` | `#5B6578` | `#9AA4B8` | Secondary text, open markers |
| `--line` | `#DDE2EA` | `#26324D` | Dividers, input borders |
| `--flag` | `#F25C05` | `#FF7A2E` | Pending and scored markers, primary actions |
| `--on-flag` | `#14213D` | `#14213D` | Text on flag orange |
| `--danger` | `#C42847` | `#FF6B85` | Reject, penalties, destructive actions |
| `--scrim` | `rgb(20 33 61 / 0.4)` | `rgb(5 10 20 / 0.6)` | Overlay behind sheets |

Rules:

- Orange means "this is ours, it counts". Use it for markers, the primary action on a screen, and the team's own row on the scoreboard. Nowhere else.
- No gradients, no tinted washes, no decorative colour.
- Every pair used for text meets WCAG AA. Check `--flag` with `--on-flag` at the sizes used before changing either.
- `--on-flag` is navy in both themes. White on `#F25C05` is 3.3:1 and fails AA for marker numbers and button labels; navy is 4.8:1.
- State is never told by colour alone. The marker shape carries it.

## The claim marker

A square, 28px on lists and 40px in the grid on phone. It encodes the claim state by shape first and colour second.

```
 Open        Pending      Scored       Rejected
 +----+      +----+       +----+       +----+
 |    |      |   /|       | 15 |       | \/ |
 |    |      |  //|       |    |       | /\ |
 +----+      +----+       +----+       +----+
 outline     lower-right  full flag,   outline in
 --muted     half --flag  points in    --danger,
                          --on-flag    diagonal cross
```

- Open: 2px `--muted` outline, empty.
- Pending: `--ink` outline, the lower-right triangle filled with `--flag`. This is the control flag itself.
- Scored: fully filled `--flag`, awarded points centred in `--on-flag`, tabular figures.
- Rejected: 2px `--danger` outline with a thin diagonal cross.
- Corner radius 3px. Markers are the only square-cornered element with this radius, so they read as objects, not buttons.
- Every marker has an accessible label: "Pending", "Scored 15 points", and so on.

## Typography

One family: **Archivo** (variable, Google Fonts), using its width axis as the active element.

| Role | Setting | Size (phone) |
|---|---|---|
| Score totals, ranks | Archivo Expanded (`wdth` 125), weight 800, tabular | 40px, scaling with `clamp()` up to 8vw on the big screen |
| Screen title | Archivo Expanded, weight 700 | 24px |
| Section heading | Archivo, weight 700 | 17px |
| Body, challenge titles | Archivo, weight 450 | 17px, line-height 1.4 |
| Secondary text | Archivo, weight 450, `--muted` | 15px |
| Point ranges | Archivo SemiCondensed (`wdth` 87), weight 600, tabular | 15px |

Rules:

- Numbers that change (totals, points, countdowns) always use `font-variant-numeric: tabular-nums` so they do not jitter when they update.
- Sentence case everywhere. No all-caps labels, no letter-spaced eyebrows above headings.
- Inputs are at least 16px so iOS does not zoom on focus.
- One exception to the single family: a pasted line quoted back in a parse error uses the system monospace font, so brackets, dashes and indentation read exactly as typed.
- Body text lines stay under 70 characters. On wide screens the content column is capped, not stretched.

## Layout

Single column, left aligned, 16px side gutters. Content max width 640px, except the admin grid and the big-screen scoreboard.

The bottom third of the screen is where thumbs reach. Primary actions live there: in bottom sheets and in a bottom bar, never only in a top header.

### Team page

```
+--------------------------------+
| 2nd   Canal Rats         145    |  sticky strip, tap to expand scoreboard
| Ends in 1:42:10                |
+--------------------------------+
| Around town                    |
| [ ] Make a birthday card  5-20 |
| [/] Free Marktplaats item 30-100|
| [15] Swim in a fountain    25  |
| Food                           |
| [x] Free dessert         10-15 |
|   Rejected: no proof received  |
+--------------------------------+
```

Tapping a row opens a bottom sheet with the description, the note field and one primary button: "Mark done". A pending row's sheet offers "Undo claim" instead.

- The strip shows the rank in Archivo Expanded at 28px and the total at the full 40px, so the team name keeps room at 390px. Tapping it expands the scoreboard in place, with the team's own row marked by a flag-orange bar on its left edge. "Rename team" sits under that list.
- A pending row reads "Waiting for a judge" under its title. A rejected row shows the reason in `--danger`.
- The sheet moves focus to itself, not to the note field, so the phone keyboard opens only when the player taps the field.
- Outside the game window the sheet keeps "Mark done" visible but disabled, with the closed message above it.
- An error in the sheet stays only while the claim it is about is unchanged. Once a poll shows a new state, the error goes, so it never contradicts the button under it.
- A confirmation shows as a toast: a `--ink` pill above the bottom edge for three seconds.

### Admin

A bottom tab bar with four tabs: Queue, Grid, Teams, Setup. The Queue tab shows a count badge of pending claims.

```
+--------------------------------+
| Queue                     3    |
+--------------------------------+
| Canal Rats, 4 min ago          |
| Make a birthday card    5-20   |
| "photo at 17:02" marked by Sam |
|                                |
| [ 5 ] [ 12 ] [ 20 ]  [ __ ]    |
| [ Reject ]          [ Score ]  |
+--------------------------------+
| Queue | Grid | Teams | Setup   |
+--------------------------------+
```

The points picker buttons are at least 56px tall. Tapping a quick value scores at once. The number field needs "Score" to confirm. A typed value outside the range moves to the nearest end when the field loses focus, so the judge sees what will be scored.

- The admin link opens on Queue once the game has teams and challenges, and on Setup before that.
- The header shows the game name with the same status line as the scoreboard, so every tab says whether the game has started or ended.
- The empty queue follows the game: "Nothing to judge yet. Claims show up here once the game starts." before, "Nothing to judge. New claims show up here." while it runs, "Nothing left to judge. The game has ended, so no new claims come in." after.
- The Queue badge is `--flag` with `--on-flag` text: pending claims are what counts next.
- Queue items have no primary button. Every item carries the same actions, so a column of orange buttons would say nothing. Score is the primary action in the grid sheet.
- "Reject" opens an optional reason field and a "Reject claim" button. That second tap is the confirmation.
- A claim judged or undone elsewhere stays in the queue where it was, showing the conflict ("Sam already scored this: 15 points.") and an "OK" button, until the judge dismisses it. It never just vanishes under a thumb.
- An earlier rejection of the same team and challenge shows under the note in `--danger`, so the judge knows what failed before.
- On admin pages the toast sits above the tab bar.

The grid has team names as columns and a sticky first column of challenge titles, so it scrolls horizontally on a phone and fits on a laptop. Each cell is a marker. Tapping a cell opens the same judging panel as the queue, in a sheet.

- The grid is the one admin screen wider than the content column. It scrolls inside its own box, so the header row and the challenge column both stay in view.
- The sheet says what a tap does in each state: score an open or rejected cell without a team claim, judge a pending one, fix or reject a scored one.
- A conflict shows under the refreshed state of the cell, the same way the team sheet does.
- A tap acts on the state the sheet showed when it opened or after its last answer. If a poll changed the cell in between, the tap gets the conflict message instead of quietly doing something else.

The Teams tab lists teams in their setup order, not by rank, so a row does not move while the judge taps it. Each team shows its rank and total, then the breakdown: scored claims, adjustments, and the late penalty with its minutes.

- "Record arrival" takes the server's clock. "Correct" and "Enter time" take a time in the viewer's time zone. "Clear" confirms first.
- The first "Record arrival" wins. A judge whose page still shows the button gets "The arrival was already recorded" under the recorded time, never a later time in its place.
- Adding an adjustment asks for Bonus or Penalty and a number, because phone number pads have no minus key. Removing one confirms first.

Setup ends with "Reset game", which returns the game to how `/new` created it: the name and the admin and scoreboard links stay, everything else goes. It confirms first, naming what gets deleted.

### Scoreboard

A ranked list. Rank and total in Archivo Expanded, team name in body weight. On screens wider than 1024px the same page becomes the big-screen view: totals scale up, the list centres vertically, and nothing else changes.

- Under the game name, one status line: "Starts in 0:42:10", "Ends in 1:42:10" or "Ended at 21:00". The scoreboard keeps updating after the end, because judging goes on at the meeting point.
- Tied teams show the same rank and keep their setup order.
- On the big screen every size follows one total size: 55% of the viewport height shared by the teams, counting at least 3, between 40px and 8vw. The 8vw cap keeps a name in view beside a four-digit total on a narrow or portrait screen, and the 3-team floor stops one or two teams from filling the screen with digits. Ranks are 0.6 of it, names 0.45, the title 0.45 and the status line 0.25, so 4 teams and 7 teams both fill a 1080px screen.
- With no teams yet: "No teams yet. They show up here once the organiser adds them."

## Components

Built on shadcn-svelte where it saves time (Button, Sheet, Dialog, Input, Tabs), restyled with the tokens above.

- Touch targets at least 48px. Rows in lists are at least 56px tall.
- Radii by hierarchy: sheets 16px on the top corners, buttons and inputs 10px, markers 3px, list rows 0 (rows are divided by `--line`, not boxed in cards).
- No box shadows except on sheets and the sticky strip, where they show something floats above the page.
- Buttons: one primary (filled `--flag`) per screen or sheet. Secondary buttons are `--ink` outlines. Destructive buttons are `--danger` outlines and confirm before acting.

## Motion

One moment matters: when a poll brings a new score, the scoreboard rows reorder with a 300ms FLIP animation, a climbing team sliding over the rows it passes, and the changed total counts up over 600ms, easing out. That is the only unprompted motion. It runs on the public scoreboard and on the team strip, both its total and its expanded list. A total counts from the value it showed, never from 0 on page load. Screen readers get only the final total.

Responses to the user's own actions are welcome and short (under 200ms): sheets slide up, a marker fills when a claim is made. With `prefers-reduced-motion`, all of it becomes an instant change.

## Copy

- Plain verbs that name what happens: "Mark done", "Undo claim", "Score", "Reject", "Record arrival". The toast repeats the verb: "Marked done", "Scored 15".
- Errors say what happened and what to do. "The game ended at 21:00. Claims are closed." Not "Something went wrong".
- Empty states invite the next action. Empty queue: "Nothing to judge. New claims show up here."
- Conflicts name the person: "Sam already scored this: 15 points."
- Times show in the viewer's time zone, in 24-hour format when the browser locale uses it.

### Offline and errors

- When a poll cannot reach the server, the page keeps what it last showed and a notice appears under the status line: "You are offline. This page updates again once you reconnect." It goes once a poll gets through. When the browser comes back online, polls run again at once, and pages that do not poll check the server.
- A page that cannot load at all says so plainly. Offline: "You are offline" with "This page loads again once you reconnect." Otherwise: "This page did not load" with "It tries again by itself. If it keeps happening, reload the page or tell your organiser." Both reload by themselves on the polling schedule once the server answers.
- A dead link: "This link does not work". It may have been replaced, so ask the organiser for the current one.
- An action that gets no answer says "This did not go through. Check your connection and try again." Team sheets and judging show it in place. Setup forms keep what was typed and show it as a toast, the one toast that is not a confirmation.

## Accessibility floor

- Visible focus ring: 2px `--ink` outline with 2px offset.
- All interactive elements reachable by keyboard, in visual order.
- Live regions announce score changes on the team strip, politely.
- A button repeated in every item ("Score", "Reject", "Record arrival", "Add adjustment") carries the team and challenge in a visually hidden label, so a screen reader list of buttons tells them apart.
- A form that opens in place of its button (Reject, Correct, Enter time, Add adjustment) takes focus itself, not its first field, so the phone keyboard stays closed. Closing it returns focus to that button.
- Moving focus scrolls controls clear of the admin tab bar, the sticky team strip and the grid's sticky header and challenge column.
- Test each milestone at 390 × 844 first, then 1280 × 800.
