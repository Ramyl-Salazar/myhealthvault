# No-slop rules

These rules bind every builder and every reviewer. They cover the interface, every piece of text a user can read, the README, the text-extraction prompt and the summary templates.

The test is simple: would a careful designer and a careful writer, working by hand for a clinic, have made this? If something is there because it is what apps usually have, it goes.

`npm run check:slop` enforces the parts a script can check. The slop reviewer checks the rest from screenshots. Passing the script is required and is not enough.

## 1. Look

### One direction, locked

- The design direction is in `docs/design/direction.md` and its values are in `src/styles/tokens.css`.
- Colour, type size, font, spacing and radius come only from those tokens. No hex values, pixel font sizes or one-off spacing in components.
- One type pairing. One palette. One spacing scale. One radius scale. One icon set (`lucide-react`), one stroke width.
- Record-type hues come only from the `--cat-*` tokens. Blue (`--color-primary`) is for actions and the active tab. Red is for allergies, destructive actions and the emergency card only.

### Banned

- Purple or indigo gradients, and gradients as decoration anywhere.
- Gradient text.
- Glass panels and background blur.
- Emoji, anywhere, including as icons or bullets.
- A card around every single item. A card groups a set (a list of reminders, one summary group, one record being checked); rows inside it are separated by a hairline, not boxed again. No cards inside cards.
- Everything centred. Text is left-aligned unless there is a reason.
- Decorative illustrations, blobs, sparkles, stock hero sections.
- Icons as decoration. An icon tile is allowed only as an identifier: one icon and one hue per record type (see the direction), the same everywhere, in a soft tint. No tile on a heading that has no record type or action behind it.
- Shadows stacked for effect. One soft card shadow (`--shadow-card`) and nothing heavier; in dark mode depth comes from the lighter surface, with no shadow.
- Bright, saturated fills. Colour comes as soft tints with a darker icon or text of the same hue; only the primary button, the verified mark and the emergency header are solid.
- Cartoon shapes, mascots, confetti, playful illustrations. Friendly here means clear and warm, not childlike.
- Animation that does not explain a change of state. No entrance animations on page load.

Banned class patterns (checked by script): `bg-gradient-to-`, `bg-linear-to-`, `from-purple-`, `from-indigo-`, `via-purple-`, `to-purple-`, `to-indigo-`, `backdrop-blur`, `bg-clip-text`.

### Required

- Every screen has a designed empty state, loading state and error state. A spinner alone is not a loading state; use the layout's own skeleton.
- Touch targets are at least 44px in both directions.
- Every screen is checked at 360, 768 and 1440 wide, in light and dark. No horizontal scrolling at 360.
- Clinical values use tabular figures and always carry their unit.
- One date format everywhere: `14 Nov 2026`, from `formatDate`.
- The three trust labels look the same wherever they appear, and are told apart by more than colour.
- Long text wraps. Nothing is cut off without a way to read the rest.
- Visible focus on every control.

## 2. Words

### Where text lives

- Every string a user can read lives in `src/copy/`. Components import it. No readable string literal in `src/screens/` or `src/ui/`.

### Style

- Sentence case for everything: titles, buttons, labels.
- No exclamation marks. No em dashes.
- Short, plain sentences. Say what the thing is or what happened.
- Buttons name the action: "Share with a doctor", "Stop sharing", "Save record". Never "Submit", "Continue", "OK" or "Get started".
- Errors say what happened and what to do next: "Not saved. Check your connection and try again."
- Empty states say what goes here and how to add it. No jokes, no cheerleading.
- Address the user as "you". The app does not call itself "we" or "I".
- The app never describes itself or its features in marketing terms inside the product.
- No AI talk. The app does not say it is intelligent, and does not call a feature AI unless it is naming the outside service a photo will be sent to.

### Banned phrases (checked by script, case-insensitive)

welcome back, seamless, seamlessly, empower, journey, unlock, AI-powered, effortless, effortlessly, supercharge, elevate, revolutionize, cutting-edge, game-changing, at your fingertips, peace of mind, take control, say goodbye to, oops, uh oh, whoops, hang tight, sit tight, awesome, magic, magical

Also banned, checked by the reviewer: "smart" as a label for a feature, "simply", "just" as a softener, "easily", "powerful", "robust", "get started".

### Clinical text

- Copied, never composed. Drug names, doses, values, units and dates appear exactly as on the record or the scanned page.
- A field that could not be read is empty. Nothing is guessed, rounded, expanded or corrected.
- The health summary is built from fixed templates filled with record fields. No sentence in it may contain a clinical word that did not come from a record.
- The app never says what a result means, whether a value is good or bad, or what the user should take or stop.
- Uncertain findings say "possible", every time.
- One caution line, used wherever the app touches medicines or follow-up, word for word:
  "This is a reminder, not medical advice. Ask your doctor or pharmacist before changing any medicine."

### Prompts

- The text-extraction prompt follows the clinical text rules: copy exactly, return null for anything unreadable, add nothing.

## 3. How it is enforced

1. `npm run check:slop` fails on: a banned phrase, `!` or an em dash in `src/copy/`; a banned class pattern in a component; an emoji anywhere in `src/`; readable JSX text in `src/screens/` or `src/ui/`.
2. The code reviewer runs that script and checks token use.
3. The slop reviewer looks at screenshots of every new or changed screen at 360, 768 and 1440, and reads every new string in `src/copy/`.
4. A task with a screen or user-facing text is not accepted until both reviewers pass it.
