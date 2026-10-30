# Design

Huntboard is used on a phone, outdoors, in a hurry, often one-handed while the other hand holds a bike or a drink. The organiser judges between WhatsApp messages, and between the photos and videos teams attach to their claims. Every screen is designed for a 390px wide phone first and grows from there.

## Direction: the control flag

Orienteering marks each checkpoint with a square flag split diagonally into orange and white. It is the most recognisable object in the world of finding things around a city, and the diagonal split is our one signature. It appears in exactly one place: the claim marker. Everything else stays quiet so the marker and the numbers carry the screen.

The palette is signal orange on a cool white, with deep navy for text.

This direction is the theme `flag`. A game can pick another theme for all its pages; see [Themes](#themes). The rest of this document describes `flag`.

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

A square, 28px on lists (`--marker-size`, which a theme may raise to 32px) and 40px in the grid on phone. It encodes the claim state by shape first and colour second.

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

- Open: 2px `--marker-outline` outline, empty. `flag` uses `--muted`.
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
- Sentence case everywhere. No all-caps labels, no letter-spaced eyebrows above headings. A theme may set the game name in its event banner in capitals, or its section headings in small capitals, as decoration.
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

Tapping a row opens a bottom sheet with the description, the note field, "Add photo or video" and one primary button: "Mark done". A pending row's sheet offers "Undo claim" instead.

- The strip shows the rank in display type at 28px and the total at the full 40px, or 32px on screens up to 400px wide. The team name takes up to two lines, so a typical name fits beside a picture and a four-digit total at 360px. Tapping it expands the scoreboard in place, with the team's own row marked by an `--own` bar on its left edge and a semibold name. "Edit team" and "Add picture" sit side by side under that list.
- "Add picture" opens the phone's photo picker and saves at once: no preview, no second tap. While it uploads the button reads "Saving picture". Once the team has a picture it reads "Change picture". The toast says "Picture saved". Teams cannot remove their picture; the organiser can.
- A picture error shows in place under the two buttons, like a sheet error.
- With a game image, the event header sits between the game name and the strip: a 48px thumbnail, the label and "View". It is not sticky, so the strip and the list keep their room at 390 × 844. Tapping it opens the image whole in a sheet, titled with the label.
- A pending row reads "Waiting for a judge" under its title, in `--waiting`. A rejected row shows the reason in `--danger`.
- The sheet moves focus to itself, not to the note field, so the phone keyboard opens only when the player taps the field. When "Add photo or video" gives way to the status row, focus moves to "Remove", and back to "Add photo or video" after Remove.
- Outside the game window the sheet keeps "Mark done" and the note field visible but disabled, with the closed message above it.
- An error in the sheet stays only while the claim it is about is unchanged. Once a poll shows a new state, the error goes, so it never contradicts the button under it.
- A confirmation shows as a toast: a `--ink` pill above the bottom edge for three seconds.
- "Add photo or video" is an optional secondary button under the note. It opens the phone's picker for photos and videos, and the work starts at once: no second tap. The button gives way to a status row: a 56px thumbnail (the photo itself, a photo tile until it is shrunk or when it fails, or a play tile for a video), a label, a progress bar and "Remove". The labels are "Shrinking photo", "Compressing video" and "Uploading" with a percentage, then "Photo attached" or "Video attached". The bar is indeterminate until the step reports progress: shrinking a photo never does, compressing a video and uploading do.
- While the media is on its way, "Mark done" stays disabled and reads "Waiting for the upload". Once attached, "Mark done" sends it with the note. A claim needs no media, so the team can still send proof in the group chat or show it in person.
- "Remove" or marking done stops any step still running and forgets the file. Closing the sheet stops a step still running, but a finished upload stays with the challenge's note, so opening the sheet again spends no second upload. An error shows in place under the status row, and "Remove" clears it so the team can pick another file. Outside the game window the button is hidden.
- A claim with media shows its thumbnail on the row, 32px between the title and the points, and in the sheet, 40px beside "Photo sent" or "Video sent". A video shows the play tile, so a list never loads videos. Thumbnails have 8px corners, so they never read as a 3px marker.
- When a poll shows that a judge scored or rejected a claim, a toast says so: "Scored 8 for Swim in a fountain", or "Rejected Free dessert: no proof received. You can mark it done again." Once claims are closed, a rejection no longer offers to mark it done again, in the toast, the row or the sheet. Several judgements show one after another, and the phone vibrates briefly where the browser allows it. Opening the page and the team's own marks and undos stay quiet.

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
- A claim's photo or video shows inline under the note, full column width and at most 256px high, so the judging buttons stay within reach. A photo fits inside the box on `--paper` and opens whole in a new tab when tapped. A video has the browser's own controls and plays inline. In the queue it loads nothing until played, so a long queue reads no media. In the grid sheet it loads its metadata. A claim without media looks as before. The media stays while the item shows a conflict.
- On admin pages the toast sits above the tab bar.

The grid has team names as columns and a sticky first column of challenge titles, so it scrolls horizontally on a phone and fits on a laptop. Each cell is a marker. Tapping a cell opens the same judging panel as the queue, in a sheet.

- The grid is the one admin screen wider than the content column. It scrolls inside its own box, so the header row and the challenge column both stay in view.
- The sheet says what a tap does in each state: score an open or rejected cell without a team claim, judge a pending one, fix or reject a scored one.
- A conflict shows under the refreshed state of the cell, the same way the team sheet does.
- The sheet shows the claim's photo or video under the claim's details, the same way the queue does.
- A tap acts on the state the sheet showed when it opened or after its last answer. If a poll changed the cell in between, the tap gets the conflict message instead of quietly doing something else.

The Teams tab lists teams in their setup order, not by rank, so a row does not move while the judge taps it. Each team shows its rank and total, then the breakdown: scored claims, adjustments, and the late penalty with its minutes.

- "Record arrival" takes the server's clock. "Correct" and "Enter time" take a time in the viewer's time zone. "Clear" confirms first.
- The first "Record arrival" wins. A judge whose page still shows the button gets "The arrival was already recorded" under the recorded time, never a later time in its place.
- Adding an adjustment asks for Bonus or Penalty and a number, because phone number pads have no minus key. The choice sets the sign: a penalty typed with a minus counts the same, and a bonus typed with one says "A bonus adds points. Choose Penalty to take points off." Removing one confirms first.

A game made before accounts opens Setup with a "My games" section: "Add to My games" for a signed-in visitor, or "Sign in to add it to your games", which returns to Setup after sign-in. A game with an owner has no such section.

The game settings end with the theme, one option per registered theme, saved with the rest of the form.

Each row in the Setup links list has "Copy", "Show QR" and "Rotate". "Show QR" opens a sheet titled "<name> link" with a large QR code of the link and the link as text under it, so an organiser can hand team links out in person. The sheet shows the current link, so after a rotation it shows the new code.

QR codes are black on white with a 4-module white margin in every theme and mode, because phone scanners misread inverted or low-contrast codes. They are drawn as SVG in the browser.

Setup has a "Game image" section under the game settings: a preview of the current image, a file field ("Image", or "Replace image" once there is one), an optional label and "Save image". Saving without a file changes only the label. "Remove image" confirms first.

In the Setup team list, a team's edit form shows its picture with "Remove picture", which confirms first. This is moderation: the team can add a new one.

Before the reset, Setup has a "Claim media" section: how many claims have a photo or video, "Download all media", and "Delete all media". The download is one zip with a folder per team and a file per claim, named after the challenge and the claim number. "Delete all media" shows only after a download in the same visit, or when no claim has media, so nobody deletes what they never saved. It confirms first and keeps the claims and scores. Media is deleted 30 days after upload anyway, and the section says so.

Setup ends with "Reset game", which returns the game to how `/new` created it: the name, the theme and the admin and scoreboard links stay, everything else goes, the game image and claim media included. The theme stays because, like the name, it belongs to the event, and a reset clears a rehearsal before that same event. It confirms first, naming what gets deleted.

### Sign-in and My games

These pages belong to no game, so they wear the default theme.

- Sign-in asks only for "Email", with "Email me a sign-in link" as the one primary button. Sign-up is the same form: the hint says the link also creates an account.
- After sending, the page becomes "Check your email": the address, a "Code" field and "Sign in", then "Use a different email" as a ghost button. A reload keeps this step while the code still works.
- A new address learns it is new only after a right code or from the link's page. Then "Your name" appears above the button, and the link's button reads "Create account".
- The link opens a page that names the address and waits for "Sign in". An expired link says so and offers "Ask for a new email".
- The dev server sends no email. It shows the link and code in a dashed box under the address instead.
- My games: "New game" as the primary button, then the games, newest first, each opening its admin link. "Sign out" comes last, as a ghost button.
- Sign-in errors show in place, above the button they are about.

### Scoreboard

A ranked list. Rank and total in display type, the total in `--score`, team name in body weight. On screens wider than 1024px the same page becomes the big-screen view: totals scale up, the list centres vertically, and a QR code of the scoreboard link sits to the right of the list.

- The QR code is `min(26dvh, 18vw)` wide, with "Scan to follow on your phone" under it in `--muted`. It encodes only the scoreboard link, built from the page's own token. Phones already have the link, so they never show it.

- Under the game name, one status line: "Starts in 0:42:10", "Ends in 1:42:10" or "Ended at 21:00". The scoreboard keeps updating after the end, because judging goes on at the meeting point.
- Tied teams show the same rank and keep their setup order.
- On the big screen every size follows one total size: 55% of the viewport height shared by the teams, counting at least 3, between 40px and 8vw. The 8vw cap keeps a name in view beside a four-digit total on a narrow or portrait screen, and the 3-team floor stops one or two teams from filling the screen with digits. Ranks are 0.6 of it, names 0.45, the title 0.45 and the status line 0.25, so 4 teams and 7 teams both fill a 1080px screen.
- With no teams yet: "No teams yet. They show up here once the organiser adds them."
- With a game image, the event header from the team page sits under the status line. On the big screen its thumbnail is 0.7 of the total size and its label 0.25, so it never pushes the list off a 800px screen.
- Team pictures sit between rank and name: 40px on a phone, 0.9 of the total size on the big screen.

## Components

Built on shadcn-svelte where it saves time (Button, Input, Label, Sheet), restyled with the tokens above.

- Touch targets at least 48px. Rows in lists are at least 56px tall.
- Radii by hierarchy: sheets 16px on the top corners, buttons and inputs 10px, markers 3px, list rows 0 (rows are divided by `--line`, not boxed in cards).
- No box shadows except on sheets and the sticky strip, where they show something floats above the page.
- Buttons: one primary (filled `--action`, label in `--on-action`) per screen or sheet. Secondary buttons are `--ink` outlines. Destructive buttons are `--danger` outlines and confirm before acting.
- shadcn's semantic names (`--primary`, `--background` and the rest) map onto the tokens in `app.css`, so generated components follow the theme.

## Themes

The admin picks a theme for the game in Setup. It changes every page of that game: the team page, the scoreboard and the admin pages, so a `flag` game keeps a `flag` admin. `DEFAULT_THEME`, Highland Bru, is the theme a game made at `/new` starts in, and the one pages without a game wear: the home page, `/new`, error pages. An id that is no longer registered also reads as `DEFAULT_THEME`.

A theme is two things:

- An entry in `src/lib/themes/index.ts`: id, name, the modes it supports with the browser chrome colour of each (the colour at the top of the page: `--paper` in the `plain` layout, `--app-bar-base` in the `event` layout), the font stylesheets it loads, its [layout](#layouts), and optionally a `wordmark`: an image and its alt text that the event app bar shows in place of "Huntboard".
- A CSS file next to it, imported by `app.css`, that sets tokens on `:root[data-game-theme='<id>']`. `flag` sits on plain `:root`, so a token a theme leaves out falls back to `flag`.
- Images in `static/themes/<id>/`: `icon.svg` for the browser tab, and `touch-icon.png` and `share.png`, the 1200 × 630 link preview that chats like WhatsApp show. Draw `icon.svg` by hand. `node scripts/theme-images.ts` renders the two PNGs, the preview from a card in that script. A theme's wordmark lives here too.

The server writes `data-game-theme` on `<html>`, so the first paint and the sheets portalled to `<body>` already wear the theme. A stored id that is no longer registered shows `DEFAULT_THEME`.

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
| `--strip`, `--on-strip` | `--surface`, `--ink` | The sticky team strip and the admin tab bar, and their text |
| `--on-strip-muted`, `--strip-line`, `--strip-score` | `--muted`, `--line`, `--ink` | Secondary text and the tabs not shown, dividers, and the total on the strip |
| `--score` | `--ink` | Score totals |
| `--section`, `--on-section` | transparent, `--ink` | Band behind team page section headings, and their text |
| `--waiting` | `--muted` | "Waiting for a judge" under a pending row |
| `--strip-own-row`, `--strip-danger`, `--strip-paper` | `--own-row`, `--danger`, `--paper` | The own row, errors, and the circle behind team initials inside the strip |
| `--marker-outline` | `--muted` | Outline of an open marker |
| `--marker-size`, `--marker-points-size` | 28px, 12px | List marker size and the points on a scored one |
| `--app-bar`, `--on-app-bar` | `--ink`, `--paper` | Event layout: the app bar background (a colour or a gradient) and its text. An event theme also sets `--app-bar-base`, its main colour, which the browser chrome matches |
| `--banner`, `--on-banner` | `--flag`, `--on-flag` | Event layout: the event banner and its text |
| `--banner-art` | none | Event layout: an image drawn in the banner's own column, never behind text |
| `--banner-title-size`, `--banner-weight`, `--banner-tracking`, `--banner-transform` | `clamp(48px, 17vw, 80px)`, 450, normal, uppercase | Event layout: size, weight, letter spacing and case of the game name in the banner (the admin banner and the page banner take all but the size) |
| `--banner-title-tail-display`, `--banner-title-tail-style`, `--banner-title-tail-weight` | inline, normal, `--banner-weight` | Event layout: the last word of a game name of two or more words, which a theme may set on its own line or in italic |
| `--banner-edge`, `--banner-edge-size` | none, 0px | Event layout: a band along the bottom of the banner, in its own padding |
| `--section-heading-font`, `--section-heading-tracking` | `700 26px/1.25 --font-display`, normal | Event layout: the `font` shorthand and letter spacing of section headings, which take `--on-section` |
| `--section-rule`, `--section-rule-width`, `--section-ornament`, `--section-ornament-order` | `--line`, 2px, none, 0 | Event layout: the rule after a section heading, the image before it, and its flex order (1 puts it after the rule) |
| `--font-sans` | Archivo | All text without a display role |
| `--font-display` | Archivo | Screen titles, ranks, section headings, sheet titles, team names on the admin Teams tab and in the event strip |
| `--font-score` | `--font-display` | Score totals |
| `--font-banner` | `--font-display` | Event layout: the game name in the banner |
| `--stretch-display`, `--stretch-condensed`, `--stretch-compressed` | 125%, 87%, 70% | Width of display type, point ranges, and marker points |

Inside the strip and the admin tab bar, the strip roles stand in for `--surface`, `--ink`, `--muted`, `--line`, `--score`, `--own-row`, `--danger` and `--paper`, so everything in it, the expanded scoreboard and a picture error included, follows the strip. The app bar and the banner do the same with `--ink` (and the banner with `--muted`), so buttons inside them take their text colour.

### Layouts

A theme's registry entry names its layout. Structure changes only through it; the theme CSS changes only tokens. Components read it with `pageLayout()` from `src/lib/themes/page-layout.ts`. Pages without a game get the layout of `DEFAULT_THEME`.

- `plain`: the layout described above. `flag` uses it.
- `event`: a slim app bar ("Huntboard" and the nickname button) and an event banner replace the game name line and the game image header. The banner shows the game name in `--font-banner`, large enough to fill the banner (17vw up to 80px, 40px past 16 characters so long names wrap into a few lines), the start day in the viewer's locale once the game has a start time, the status line, and with a game image its thumbnail and "View <label>", which open the same sheet as the event header. Only the button is a control for keyboards and screen readers; the thumbnail is a larger target for thumbs. On the team page the strip shows the rank, a divider, the team name in 20px `--font-display` on up to two lines with the countdown under it, the total and the chevron; members show in the expanded list. The countdown is hidden from the strip button's name, which would otherwise change every second, and repeated outside it for screen readers. The focus ring sits inside the strip. Section headings are 26px `--font-display` with `--section-ornament` before and a 2px `--section-rule` border to the right edge. Rows lose the top border and add the description clamped to two lines, a 15px "points" unit under a 17px range with thin spaces around the dash, and a chevron. The scoreboard puts a "Leaderboard" heading over a 2px `--score` rule, team names in semibold, team pictures at 48px, and a 15px "points" under each total. On the big screen the app bar and banner sizes follow the screen height instead of the total size, and the banner puts the game name in one wide row, its last word included, with the details beside it, and the teams share 34% of the height instead of 55%, so 4 to 7 teams still fit 1280 × 800 and 1920 × 1080.
  - Admin pages are worked fast on a phone, so they keep their density and touch sizes and skip the big banner. Under the app bar a one-row banner shows the game name in 32px `--font-banner` and the status line. The tab bar marks the current tab with a 4px bar in the strip's text colour along its top, and its focus ring sits inside the bar.
  - The home page and `/new` have no game, so their banner holds the page title in `--font-banner` and one line under it, with `--banner-art` beside. Error pages add only the app bar.

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

`highland-bru`, light only, `event` layout. Made for a Scottish birthday. The theme brings only the mood: names, faces and inside jokes come from the game name, the game image and the challenge text, never from the app's code or copy.

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
| `--app-bar`, `--app-bar-base` | A tartan of crossed red and blue stripes on dark green `#10241B`, drawn with gradients. White text stays above 8:1 on every stripe. The browser chrome is `#10241B`. |
| `--strip-paper` | `#0C3A9E`, so team initials on the strip are `#D9E3FF` at 7.8:1 |
| `--marker-outline`, `--marker-size`, `--marker-points-size` | Ink, 32px, 15px |
| `--banner-art`, `--section-ornament` | An ink thistle in the banner, a small orange thistle before each section heading |

Fonts: Fraunces (bold serif) for `--font-display`, Barlow for `--font-sans`, Barlow Condensed for `--font-score`, and Jersey 10, a pixel face, for `--font-banner`, where the game name is set in capitals as decoration. None has a width axis, so the `--stretch-*` tokens are `normal`.

### Lightmile Azulejo

`azulejo`, light only, `event` layout. Made for the Lightmile club trip to Málaga: ceramic blue and terracotta on warm cream, like a printed travel journal with tile details. The app bar shows the Lightmile wordmark from `static/themes/azulejo/wordmark.svg`, the club's own artwork, in place of "Huntboard".

| Role | Value |
|---|---|
| `--paper`, `--surface` | Cream `#FFF7E8`, `#FFFAF0` |
| `--ink`, `--muted`, `--line` | `#283950` (11:1), `#726451` (5.4:1), `#DED3BE` |
| `--marker`, `--action`, `--own`, `--section-rule`, `--on-section`, `--waiting` | Terracotta `#B8412D` (5.1:1 on cream), with cream `#FFFAF0` on it (5.3:1) |
| `--own-row` | `#F5DFCC` |
| `--strip`, `--on-strip`, `--strip-score` | Ceramic blue `#24468C`, cream (8.5:1) |
| `--on-strip-muted`, `--strip-own-row`, `--strip-danger` | `#D5DDEF` (6.6:1 at 15px), `#1B3770`, `#FFD2C8` (6.6:1) |
| `--score`, `--on-banner` | Ceramic blue, 8.5:1 on cream |
| `--danger` | `#A32020` (7.1:1) |
| `--app-bar`, `--app-bar-base`, `--on-app-bar` | Cream with a `--line` hairline at the bottom, ink text. The browser chrome is `#FFF7E8`. |
| `--banner`, `--banner-edge` | Cream, edged with alternating blue and terracotta tiles |
| `--strip-paper` | `#1B3770` |
| `--marker-outline` | `#726451` |
| `--banner-art`, `--section-ornament` | A terracotta 2 × 2 tile in the banner, a small terracotta star after each section rule |

Fonts: Georgia for `--font-display` and `--font-banner`, so the game name, ranks and team names are a bold serif. The banner sets the last word of the game name on its own line in Georgia italic. Section headings are 17px Georgia small capitals. Archivo stays the sans and the score font. Georgia is a system font, so the theme loads only Archivo, and phones without Georgia fall back to their serif.

### Team pictures and the game image

A team picture is a circle, so it never reads as a marker. Without a picture a team shows its initial in `--muted` on `--paper`, inside a `--line` border.

- Pictures and initials appear only once at least one team in the game has a picture. A game without pictures looks exactly as before.
- Sizes are fixed per place, so a loading picture never changes a row height or the reorder animation: 40px in the strip, 32px in the expanded list and the Setup team list, 40px on the scoreboard.
- The picture is decorative: the team name is always beside it, so it has empty alt text.
- The game image label names the image for everyone: it is the event header text, the sheet title and the alt text. Without a label it reads "Game image".
- Images are shrunk in the browser before upload: team pictures to a 256px square cropped from the middle, the game image to 1600px on its long edge. A phone never uploads a full-size photo.

### Claim media

- Photos are shrunk in the browser to 1600px on their long edge, like the game image, and stay under 512 KB.
- Videos are re-encoded in the browser to 720p H.264 at about 2 Mbps, at most 60 seconds long. A video that already fits that budget goes as it is. So does an MP4, MOV or WebM up to 80 MB that re-encoding would not make smaller. A phone that cannot re-encode sends the original MP4, MOV or WebM, up to 80 MB.
- The phone uploads straight to storage, never through the app, so a slow upload never blocks other requests.

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

- When a poll cannot reach the server, the page keeps what it last showed and a notice appears under the status line: "You are offline. This page updates again once you reconnect." It goes once a poll gets through. When the server answers a poll with an error, the page also keeps what it showed, open sheets and typed notes included, and the notice reads "This page did not update. It tries again by itself." A dead link still shows the dead link page. When the browser comes back online, polls run again at once, and pages that do not poll check the server.
- A page that cannot load at all says so plainly. Offline: "You are offline" with "This page loads again once you reconnect." Otherwise: "This page did not load" with "It tries again by itself. If it keeps happening, reload the page or tell your organiser." Both reload by themselves on the polling schedule once the server answers.
- A dead link: "This link does not work". It may have been replaced, so ask the organiser for the current one.
- An action that gets no answer says "This did not go through. Check your connection and try again." Team sheets and judging show it in place. Setup forms keep what was typed and show it as a toast. The only other toasts that are not a confirmation tell a team about a judgement.
- A file the browser cannot open: "This file is not an image this browser can read. Choose a JPEG, PNG or WebP image." A file that stays too large after shrinking: "This image stays too large even when shrunk. Choose another one." Both show in place before anything is sent.
- Claim media errors show in place in the sheet, under the status row:
  - A file that is neither: "Choose a photo or a video."
  - A video over the time limit: "This video is longer than 60 seconds. Trim it and try again."
  - A video the phone cannot convert: "This phone cannot convert this video. Send an MP4, MOV or WebM video." One it cannot read: "This file is not a video this browser can read. Choose an MP4, MOV or WebM video."
  - Too large: "This video is too large to send from this phone. Send a shorter one." and "This video stays too large even when compressed. Send a shorter one."
  - When the server refuses the file at "Mark done": "This photo or video did not finish uploading. Attach it again." or "This file is not a photo or video the app takes. Choose a JPEG or WebP photo, or an MP4, MOV or WebM video."
  - When the server takes no uploads: "Photos and videos cannot be attached right now. Mark it done without one and send the proof another way."
  - When the team or the game has reached its upload limit: "Your team has sent all the photos and videos this game allows. Mark it done without one and show a judge in person." or "This game has no room left for photos and videos. Mark it done without one and show a judge in person."
  - A failed upload gets the usual "This did not go through. Check your connection and try again."

## Accessibility floor

- Visible focus ring: 2px `--ink` outline with 2px offset.
- All interactive elements reachable by keyboard, in visual order.
- Live regions announce score changes on the team strip, politely.
- Points read with their unit: a range as "5 to 20 points", a single value as "25 points".
- A button repeated in every item ("Score", "Reject", "Record arrival", "Add adjustment") carries the team and challenge in a visually hidden label, so a screen reader list of buttons tells them apart.
- A form that opens in place of its button (Reject, Correct, Enter time, Add adjustment) takes focus itself, not its first field, so the phone keyboard stays closed. Closing it returns focus to that button.
- Closing the nickname prompt moves focus to the nickname button, the first prompt included.
- Moving focus scrolls controls clear of the admin tab bar, the sticky team strip and the grid's sticky header and challenge column.
- Test each milestone at 390 × 844 first, then 1280 × 800.
