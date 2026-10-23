# Design

Huntboard is used on a phone, outdoors, in a hurry, often one-handed while the other hand holds a bike or a drink. The organiser judges between WhatsApp messages. Every screen is designed for a 390px wide phone first and grows from there.

## Direction: the control flag

Orienteering marks each checkpoint with a square flag split diagonally into orange and white. It is the most recognisable object in the world of finding things around a city, and the diagonal split is our one signature. It appears in exactly one place: the claim marker. Everything else stays quiet so the marker and the numbers carry the screen.

The palette is signal orange on a cool white, with deep navy for text. Orange is also the Dutch colour, which suits the reference event without naming it.

This direction is the default theme, `flag`. A game can pick another theme for its team page and scoreboard; see [Themes](#themes). The rest of this document describes `flag`.

## Color

Defined as CSS custom properties in `src/lib/themes/flag.css`, with the dark set inside `@variant dark`, which follows `prefers-color-scheme` and the `data-theme` override. The hunt runs from afternoon into evening, so dark mode is first-class, not an afterthought.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#F5F7FA` | `#0F1A30` | Page background |
| `--surface` | `#FFFFFF` | `#17233D` | Sheets, rows, inputs |
| `--ink` | `#14213D` | `#EEF1F6` | Text, outlines, icons |
| `--muted` | `#5B6578` | `#9AA4B8` | Secondary text, open markers |
| `--line` | `#DDE2EA` | `#26324D` | Dividers, input borders |
| `--flag` | `#F25C05` | `#FF7A2E` | The orange behind `--marker`, `--action` and `--own` |
| `--on-flag` | `#14213D` | `#14213D` | Text on flag orange |
| `--danger` | `#C42847` | `#FF6B85` | Reject, penalties, destructive actions |
| `--scrim` | `rgb(20 33 61 / 0.4)` | `rgb(5 10 20 / 0.6)` | Overlay behind sheets |

Components never use `--flag` directly. They use the role tokens in [Themes](#themes), which `flag` maps onto these colours.

Rules:

- `--marker`, `--action` and `--own` mean "this is ours, it counts". Use them for markers, the primary action on a screen, and the team's own row. Nowhere else. In `flag` all three are orange.
- No gradients, no tinted washes, no decorative colour.
- Every pair used for text meets WCAG AA. Check each role with its `--on-` pair at the sizes used before changing either.
- `--on-flag` is navy in both modes. White on `#F25C05` is 3.3:1 and fails AA for marker numbers and button labels; navy is 4.8:1.
- State is never told by colour alone. The marker shape carries it.

## The claim marker

A square, 28px on lists and 40px in the grid on phone. It encodes the claim state by shape first and colour second.

```
 Open        Pending      Scored       Rejected
 +----+      +----+       +----+       +----+
 |    |      |   /|       | 15 |       | \/ |
 |    |      |  //|       |    |       | /\ |
 +----+      +----+       +----+       +----+
 outline     lower-right  full         outline in
 --muted     half         --marker,    --danger,
             --marker     points in    diagonal cross
                          --on-marker
```

- Open: 2px `--muted` outline, empty.
- Pending: `--ink` outline, the lower-right triangle filled with `--marker`. This is the control flag itself.
- Scored: fully filled `--marker`, awarded points centred in `--on-marker`, tabular figures.
- Rejected: 2px `--danger` outline with a thin diagonal cross.
- Corner radius 3px. Markers are the only square-cornered element with this radius, so they read as objects, not buttons.
- Every marker has an accessible label: "Pending", "Scored 15 points", and so on.

## Typography

One family: **Archivo** (variable, Google Fonts), using its width axis as the active element. It fills every font token: `--font-sans` for everything, `--font-display` for screen titles, ranks and team page section headings, and `--font-score` for totals, which `flag` points at `--font-display`. The widths come from `--stretch-display` (125), `--stretch-condensed` (87) and `--stretch-compressed` (70), so a theme with a font that has no width axis can set them to `normal`.

| Role | Setting | Size (phone) |
|---|---|---|
| Score totals, ranks (`type-score`, `type-rank`) | Archivo Expanded (`wdth` 125), weight 800, tabular | 40px, scaling with `clamp()` up to 8vw on the big screen |
| Screen title | Archivo Expanded, weight 700 | 24px |
| Section heading | Archivo, weight 700 | 17px |
| Body, challenge titles | Archivo, weight 450 | 17px, line-height 1.4 |
| Secondary text | Archivo, weight 450, `--muted` | 15px |
| Point ranges | Archivo SemiCondensed (`wdth` 87), weight 600, tabular | 15px |

Rules:

- Numbers that change (totals, points, countdowns) always use `font-variant-numeric: tabular-nums` so they do not jitter when they update.
- Sentence case everywhere. No all-caps labels, no letter-spaced eyebrows above headings. A theme may set the game name in its event banner in capitals, as decoration.
- Inputs are at least 16px so iOS does not zoom on focus.
- One exception to the single family: a pasted line quoted back in a parse error uses the system monospace font, so brackets, dashes and indentation read exactly as typed.
- Body text lines stay under 70 characters. On wide screens the content column is capped, not stretched.

## Layout

Single column, left aligned, 16px side gutters. Content max width 640px, except the admin grid and the big-screen scoreboard.

The bottom third of the screen is where thumbs reach. Primary actions live there: in bottom sheets and in a bottom bar, never only in a top header.

### Team page

```
+--------------------------------+
| [img] Birthday invitation View >|  game image, only when set; scrolls away
+--------------------------------+
| 2nd (o) Canal Rats       145    |  sticky strip, tap to expand scoreboard
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

- The strip shows the rank in display type at 28px and the total at the full 40px, so the team name keeps room at 390px. Tapping it expands the scoreboard in place, with the team's own row marked by an `--own` bar on its left edge and a semibold name. "Edit team" and "Add picture" sit side by side under that list.
- "Add picture" opens the phone's photo picker and saves at once: no preview, no second tap. While it uploads the button reads "Saving picture". Once the team has a picture it reads "Change picture". The toast says "Picture saved". Teams cannot remove their picture; the organiser can.
- A picture error shows in place under the two buttons, like a sheet error.
- With a game image, the event header sits between the game name and the strip: a 48px thumbnail, the label and "View". It is not sticky, so the strip and the list keep their room at 390 × 844. Tapping it opens the image whole in a sheet, titled with the label.
- A pending row reads "Waiting for a judge" under its title, in `--waiting`. A rejected row shows the reason in `--danger`.
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
- The Queue badge is `--marker` with `--on-marker` text: pending claims are what counts next.
- Queue items have no primary button. Every item carries the same actions, so a column of primary buttons would say nothing. Score is the primary action in the grid sheet.
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

The game settings end with the theme, one option per registered theme, saved with the rest of the form.

Setup has a "Game image" section under the game settings: a preview of the current image, a file field ("Image", or "Replace image" once there is one), an optional label and "Save image". Saving without a file changes only the label. "Remove image" confirms first.

In the Setup team list, a team's edit form shows its picture with "Remove picture", which confirms first. This is moderation: the team can add a new one.

Setup ends with "Reset game", which returns the game to how `/new` created it: the name, the theme and the admin and scoreboard links stay, everything else goes, the game image included. The theme stays because, like the name, it belongs to the event, and a reset clears a rehearsal before that same event. It confirms first, naming what gets deleted.

### Scoreboard

A ranked list. Rank and total in display type, the total in `--score`, team name in body weight. On screens wider than 1024px the same page becomes the big-screen view: totals scale up, the list centres vertically, and nothing else changes.

- Under the game name, one status line: "Starts in 0:42:10", "Ends in 1:42:10" or "Ended at 21:00". The scoreboard keeps updating after the end, because judging goes on at the meeting point.
- Tied teams show the same rank and keep their setup order.
- On the big screen every size follows one total size: 55% of the viewport height shared by the teams, counting at least 3, between 40px and 8vw. The 8vw cap keeps a name in view beside a four-digit total on a narrow or portrait screen, and the 3-team floor stops one or two teams from filling the screen with digits. Ranks are 0.6 of it, names 0.45, the title 0.45 and the status line 0.25, so 4 teams and 7 teams both fill a 1080px screen.
- With no teams yet: "No teams yet. They show up here once the organiser adds them."
- With a game image, the event header from the team page sits under the status line. On the big screen its thumbnail is 0.7 of the total size and its label 0.25, so it never pushes the list off a 800px screen.
- Team pictures sit between rank and name: 40px on a phone, 0.9 of the total size on the big screen.

## Components

Built on shadcn-svelte where it saves time (Button, Sheet, Dialog, Input, Tabs), restyled with the tokens above.

- Touch targets at least 48px. Rows in lists are at least 56px tall.
- Radii by hierarchy: sheets 16px on the top corners, buttons and inputs 10px, markers 3px, list rows 0 (rows are divided by `--line`, not boxed in cards).
- No box shadows except on sheets and the sticky strip, where they show something floats above the page.
- Buttons: one primary (filled `--action`, label in `--on-action`) per screen or sheet. Secondary buttons are `--ink` outlines. Destructive buttons are `--danger` outlines and confirm before acting.
- shadcn's semantic names (`--primary`, `--background` and the rest) map onto the tokens in `app.css`, so generated components follow the theme.

## Themes

The admin picks a theme for the game in Setup. It changes the team page and the scoreboard. Admin pages, `/new` and error pages always use `flag`.

A theme is two things:

- An entry in `src/lib/themes/index.ts`: id, name, the modes it supports with the browser chrome colour of each, the font stylesheets it loads, and its [layout](#layouts).
- A CSS file next to it, imported by `app.css`, that sets tokens on `:root[data-game-theme='<id>']`. `flag` sits on plain `:root`, so a token a theme leaves out falls back to `flag`.

The server writes `data-game-theme` on `<html>`, so the first paint and the sheets portalled to `<body>` already wear the theme. A stored id that is no longer registered shows `flag`.

A theme supports light, dark or both. With one mode, the server also writes `data-theme` and that mode wins over the phone setting. With both, it follows the phone, and the dark set is declared once inside `@variant dark`. `/dev/design?theme=<id>&mode=dark` previews any theme in any mode it supports.

### Token roles

Components use roles, never a theme's own colour names.

| Role | In `flag` | Use |
|---|---|---|
| `--paper`, `--surface`, `--ink`, `--muted`, `--line`, `--danger`, `--scrim` | See [Color](#color) | The base palette |
| `--marker`, `--on-marker` | `--flag`, `--on-flag` | Pending triangle and scored fill, the points on it, the Queue badge |
| `--action`, `--on-action` | `--flag`, `--on-flag` | The primary button and its label |
| `--own` | `--flag` | Bar on the team's own row |
| `--own-row` | `--strip` | Background of the team's own row |
| `--strip`, `--on-strip` | `--surface`, `--ink` | The sticky team strip and its text |
| `--on-strip-muted`, `--strip-line`, `--strip-score` | `--muted`, `--line`, `--ink` | Secondary text, dividers and the total on the strip |
| `--score` | `--ink` | Score totals |
| `--section`, `--on-section` | transparent, `--ink` | Band behind team page section headings, and their text |
| `--waiting` | `--muted` | "Waiting for a judge" under a pending row |
| `--strip-own-row`, `--strip-danger` | `--own-row`, `--danger` | The own row and errors inside the strip |
| `--app-bar`, `--on-app-bar` | `--ink`, `--paper` | Event layout: the app bar background (a colour or a gradient) and its text |
| `--banner`, `--on-banner` | `--flag`, `--on-flag` | Event layout: the event banner and its text |
| `--banner-art` | none | Event layout: an image drawn in the banner's own column, never behind text |
| `--section-rule`, `--section-ornament` | `--line`, none | Event layout: the rule after a section heading and the image before it |
| `--font-sans` | Archivo | All text without a display role |
| `--font-display` | Archivo | Screen titles, ranks, team page section headings, team name in the event strip |
| `--font-score` | `--font-display` | Score totals |
| `--font-banner` | `--font-display` | Event layout: the game name in the banner |
| `--stretch-display`, `--stretch-condensed`, `--stretch-compressed` | 125%, 87%, 70% | Width of display type, point ranges, and marker points |

Inside the strip, the strip roles stand in for `--surface`, `--ink`, `--muted`, `--line`, `--score`, `--own-row` and `--danger`, so everything in it, the expanded scoreboard and a picture error included, follows the strip. The app bar and the banner do the same with `--ink` (and the banner with `--muted`), so buttons inside them take their text colour.

### Layouts

A theme's registry entry names its layout. Structure changes only through it; the theme CSS changes only tokens. Components read it with `pageLayout()` from `src/lib/themes/page-layout.ts`, so admin pages, `/new` and error pages, which carry no game theme, always get `plain`.

- `plain`: the layout described above. `flag` uses it.
- `event`: a slim app bar ("Huntboard" and the nickname button) and an event banner replace the game name line and the game image header. The banner shows the game name in `--font-banner`, the start day in the viewer's locale once the game has a start time, the status line, and with a game image its thumbnail and "View <label>", which opens the same sheet as the event header. On the team page the strip shows the rank, a divider, the team name in `--font-display` with the countdown under it, the total and the chevron; members show in the expanded list. Section headings are 26px `--font-display` with `--section-ornament` before and a `--section-rule` line to the right edge. Rows lose the top border and add the description clamped to two lines, a "points" unit under the range and a chevron. The scoreboard puts a "Leaderboard" heading over a 2px `--score` rule, team names in semibold, team pictures at 48px, and "points" under each total. On the big screen the banner sizes follow the screen height instead of the total size, and the teams share 34% of the height instead of 55%, so 4 to 7 teams still fit 1280 × 800 and 1920 × 1080.

### What a theme may change

- The palette and every role above.
- The display font, and the sans font. The theme's stylesheets load every family its tokens name, Archivo included while it keeps the `flag` sans.
- Decoration in the event heading and the page margins. It never sits behind a row, a button or a number.

### What a theme keeps

- Marker shapes: the outline, the lower-right triangle, the full square and the diagonal cross. Only their colours change.
- Spacing, radii and touch sizes. Layout changes only through the registered [layouts](#layouts).
- WCAG AA for every text pair, checked in each mode the theme supports. That includes each `--on-` pair, `--waiting` on `--paper` and `--on-strip-muted` on `--strip` at 15px.
- State told by shape and words, not colour alone. The own row keeps its bar and its semibold name.

### Highland Bru

`highland-bru`, light only, `event` layout. Made for a Scottish birthday whose invitation is orange with cobalt: the event brings the people through its game name and image, the theme brings only the mood.

| Role | Value |
|---|---|
| `--paper`, `--surface` | Ivory `#FFF9EF`, `#FFFDF8` |
| `--ink`, `--muted`, `--line` | `#151515`, `#5E564D`, `#E8DCC8` |
| `--marker`, `--action`, `--own`, `--banner`, `--section-rule` | Orange `#FF741F`, with ink on it (6.8:1; white is 2.7:1 and fails) |
| `--own-row` | `#FFE8D6` |
| `--strip`, `--on-strip`, `--strip-score` | Cobalt `#124BCC`, white (7.2:1) |
| `--on-strip-muted`, `--strip-own-row`, `--strip-danger` | `#D9E3FF` (5.6:1 at 15px), `#0C3A9E`, `#FFD1CC` (5.3:1) |
| `--score` | Cobalt, 6.9:1 on ivory |
| `--waiting`, `--danger` | `#B34700` (5.3:1), `#B3261E` (6.2:1) |
| `--app-bar` | A dark green tartan of crossed red and blue stripes, drawn with gradients. White text stays above 8:1 on every stripe. |
| `--banner-art`, `--section-ornament` | An ink thistle in the banner, a small orange thistle before each section heading |

Fonts: Fraunces (bold serif) for `--font-display`, Barlow for `--font-sans`, Barlow Condensed for `--font-score`, and Jersey 10, a pixel face, for `--font-banner`, where the game name is set in capitals as decoration. None has a width axis, so the `--stretch-*` tokens are `normal`.

### Team pictures and the game image

A team picture is a circle, so it never reads as a marker. Without a picture a team shows its initial in `--muted` on `--paper`, inside a `--line` border.

- Pictures and initials appear only once at least one team in the game has a picture. A game without pictures looks exactly as before.
- Sizes are fixed per place, so a loading picture never changes a row height or the reorder animation: 40px in the strip, 32px in the expanded list and the Setup team list, 40px on the scoreboard.
- The picture is decorative: the team name is always beside it, so it has empty alt text.
- The game image label names the image for everyone: it is the event header text, the sheet title and the alt text. Without a label it reads "Game image".
- Images are shrunk in the browser before upload: team pictures to a 256px square cropped from the middle, the game image to 1600px on its long edge. A phone never uploads a full-size photo.

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
- A file the browser cannot open: "This file is not an image this browser can read. Choose a JPEG, PNG or WebP image." A file that stays too large after shrinking: "This image stays too large even when shrunk. Choose another one." Both show in place before anything is sent.

## Accessibility floor

- Visible focus ring: 2px `--ink` outline with 2px offset.
- All interactive elements reachable by keyboard, in visual order.
- Live regions announce score changes on the team strip, politely.
- A button repeated in every item ("Score", "Reject", "Record arrival", "Add adjustment") carries the team and challenge in a visually hidden label, so a screen reader list of buttons tells them apart.
- A form that opens in place of its button (Reject, Correct, Enter time, Add adjustment) takes focus itself, not its first field, so the phone keyboard stays closed. Closing it returns focus to that button.
- Moving focus scrolls controls clear of the admin tab bar, the sticky team strip and the grid's sticky header and challenge column.
- Test each milestone at 390 × 844 first, then 1280 × 800.
