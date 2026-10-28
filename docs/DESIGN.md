# Rehearse design spec

Source of truth for how the app should look. The two reference mocks live in `docs/design/` (custom `.dc.html` format, open them for exact structure, sizes, and copy, but do not copy their code into the app). Where this file and the mocks disagree, the mocks win.

## Principles

- Calm, focused developer tool. Think Linear or VS Code, not a flashy startup.
- Dark theme only. One accent color. No gradients except the voice orb.
- The voice orb is the visual centerpiece of the interview screen.
- No emoji, no human faces. Icons are inline stroke SVGs.
- Generous spacing. Real `<button>`, `<select>`, `<a>` elements. `aria-label` on icon-only buttons. Respect `prefers-reduced-motion`.

## Tokens

Colors

| Token | Value | Use |
| --- | --- | --- |
| bg | `#0B0D10` | page background |
| surface-1 | `#0E1116` | top bars, problem panel, editor, interviewer panel |
| surface-2 | `#12151A` | cards, test panel, example boxes |
| surface-3 | `#161B22` | tags, chat bubbles, secondary buttons, select |
| border | `#232830` | all dividers and card borders |
| border-strong | `#2F3742` | secondary button and select borders |
| text | `#E6E9EE` | primary text |
| text-2 | `#C4CBD6` | body copy, descriptions |
| muted | `#9AA3B0` | labels, hints, timestamps |
| accent | `#2DD4BF` | primary actions, current phase, orb, active tab |
| on-accent | `#05201C` | text and icons on accent fills |
| accent-soft | accent at 14% alpha (`#2DD4BF24`) | user bubble fill, highlighted code line, orb glow |
| success | `#5FD39A` | passed tests, Strength tag text |
| success-bg | `#10261C` | Strength tag background |
| danger | `#FF8A8A` | failed tests, error output |
| danger-border | `#5C2B30` | failed case border, End interview border |
| danger-text | `#FF9B9B` | End interview text |
| warn | `#F5B351` | Medium tag, Needs work tag text |
| warn-bg | `#2A2110` | Medium and Needs work tag background |
| warn-border | `#5C4A1E` | Needs work timeline card border |
| code-number | `#6F7A8A` | line numbers |

Accent must be one variable so it can be swapped (teal, blue `#5B9DFF`, purple `#A78BFA`, amber `#F5B351` were all tried in the mock). Text on accent stays `on-accent`.

Syntax colors (editor): keyword `#C4A7FF`, function `#7AA2F7`, number `#FF9E64`, string `#9ECE6A`, comment `#8491A3`.

Type

- UI: Inter, 400/500/600. Base 14px. Small labels 12 to 13px.
- Code, timers, scores, test inputs: JetBrains Mono. Editor 13.5px with 22px line height.
- Section labels: 12px, weight 500, uppercase, letter spacing 0.06em, muted color.
- Page titles: 22px (problem title) and 30px (report title), weight 600, letter spacing slightly negative.

Shape and spacing

- Radius: 6px tags and small buttons, 8px buttons and inputs, 10px to 14px cards, full round for orb, mic, and step circles.
- Panel padding 24px. Top bar padding 12px 24px. Card padding 14px to 28px depending on size.
- Gaps: 8, 10, 12, 16, 20, 24. Keep to this scale.

## Interview screen (`/interview`)

Reference: `docs/design/interview-screen.dc.html`

Top bar: logo mark (ring with filled center) and "Rehearse"; center phase indicator; right side a mono timer with clock icon and an "End interview" outline button in the danger colors.

Phase indicator: 5 steps (Intro, Approach, Coding, Follow-ups, Wrap-up) joined by 20px lines. Done steps: accent outline circle with check and accent text. Current step: filled accent circle with its number, text color `text`, weight 500, `aria-current="step"`. Upcoming: `#3A424E` outline circle with number and muted text.

Body is three columns that wrap on narrow screens:

1. Problem panel (flex 1, min 340px, max 440px, surface-1, right border). Label, title, tags (difficulty, topics), statement, Example boxes (mono, surface-2), Constraints list, and a locked Hints card pinned to the bottom. Hints card has a lock icon, "3 locked" count, one line of help text, and disabled dashed hint rows.
2. Editor column (flex 3, min 520px). Top strip: file tab and language select on the left, "Interviewer can see your code" with an eye icon on the right. Then the code area (surface-1, line numbers, active line highlighted with accent-soft). Then a status and action bar: cursor position in mono on the left, Run (secondary with play icon) and Submit (accent, weight 600) on the right. Then the test results panel (surface-2): tabs "Test results" and "Console", pass and fail counts, and one row per case. Passed rows show a check and "Passed". Failed rows have a danger border, an X and "Failed", and an Expected vs Actual line. Status is always icon plus text, never color alone.
3. Interviewer panel (flex 1, min 340px, max 440px, surface-1, left border). Orb on top, state label below it, transcript in the middle, controls at the bottom.

Voice orb

- 190px box. Core is a circle inset 34px with a radial gradient: light highlight at 35% 30%, accent at 45%, very dark accent shade at the edge. Soft accent glow shadow.
- Two outline rings (1.5px accent) behind the core.
- Speaking: rings expand from scale .72 to 1.18 and fade, 2.6s loop, second ring delayed 1.3s. A row of 9 accent waveform bars (4px wide) animates next to the label "Interviewer is speaking".
- Listening: rings breathe (scale .88 to 1.02, opacity .22 to .5, 3.2s), label "Listening to you", same bars.
- Thinking: core pulses (scale .94 to 1.02 with brightness shift, 1.8s), label "Interviewer is thinking..." with three fading dots, no bars.

Transcript

- Interviewer messages: left aligned, surface-3 bubble, small top-left corner. Label like "Interviewer · 24:02" in muted 12px above.
- User messages: right aligned, accent-soft fill with a 1px accent border, small top-right corner. Label "You · 24:09".
- Live speech: interviewer text streams with a blinking caret. User partial text is italic with a dashed accent border and a caret.

Controls

- Mic button 68px circle, centered. Idle: surface-3 fill, 1.5px accent border, accent icon. Active (listening): accent fill, on-accent icon, 6px accent-soft ring around it.
- Mute toggle and captions button: 44px circles, surface-3, border-strong, `aria-pressed` on mute.
- Hint text under the controls in muted 12.5px: "Hold Space to interrupt", "Release Space to send", or "Hold Space to talk" depending on state.

## Feedback report (`/report/[id]`)

Reference: `docs/design/feedback-report.dc.html`

Content width max 1200px, centered, 24px side padding.

- Header: top bar with logo and "Interview complete". Then label "Feedback report", title, and a meta row (difficulty tag, language, mono duration, date). Right side: "Review transcript" (secondary) and "Practice again" (accent, refresh icon).
- Overall score card (max 360px): 168px ring, 10px stroke, round cap, accent on a border-colored track, mono score centered with "out of 100". Below: a verdict title and one sentence, then three stat rows (Hints used, Tests passed on submit, Runs before submit) separated by a top border.
- Four category cards in a wrapping grid (min 260px each): Communication, Problem Solving, Code Quality, Complexity Analysis. Each has the name, a mono score, a 6px score bar in accent on a border-colored track, and a paragraph of specific feedback.
- Key moments: a vertical list of cards. Each card: mono timestamp column (56px), a Strength or Needs work tag (icon plus text), a bold title, a one-line description, and outline buttons on the right ("Transcript", and "Code v3" style buttons in accent outline). Needs work cards use the warn-border.

Feedback tone: specific and honest, quote what the user said or wrote, no inflated scores.

## Responsive and accessibility

- Layouts use wrapping flex with min and max widths so they stack on narrow screens. Toolbars wrap.
- Text contrast at least 4.5:1. Status is never color alone.
- Visible focus ring on every interactive element (2px, light teal, 2px offset).
- All animation stops under `prefers-reduced-motion`.
