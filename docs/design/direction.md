# Design direction

Status: approved by the owner on 15 Nov 2026 (direction 2). Mockups: `docs/design/mockups/` (open any `.html` file in a browser; each shows light and dark at 360 wide). The mockups are the visual reference for every screen; `mock.css` shows how each component is built from the tokens.

Direction 1 (flat, ink-only, no icons) was rejected by the owner as too plain and harsh. Direction 2 keeps its structure and adds icons, colour and softer shapes, without becoming childlike.

## The read

A friendly record tool for adult patients in long-term care and the clinicians they hand it to. Clear and warm, in a soft, rounded language. The strongest thing on every screen is the record itself.

Dials: variance 3, motion 2, density 5.

## Two ideas that repeat on every screen

**Every kind of record has one icon and one hue.** The same tile appears on the home summary, the timeline, the scan check, the clinician view and the emergency card.

| Record type | Icon (lucide) | Token |
|---|---|---|
| Medicine | `pill` | `--cat-medicine` |
| Condition | `heart-pulse` | `--cat-condition` |
| Lab result | `flask-conical` | `--cat-result` |
| Visit | `stethoscope` | `--cat-visit` |
| Immunization | `syringe` | `--cat-vaccine` |
| Procedure | `scissors` | `--cat-procedure` |
| Allergy | `triangle-alert` | `--cat-allergy` |

**How far to trust a record is shown by one of three marks**, told apart by border style, icon and fill as well as colour:

| Level | Mark |
|---|---|
| Entered by patient | Dashed amber outline on a soft amber tint, `pencil` |
| Supported by a document | Solid blue outline on a soft blue tint, `file-text` |
| Verified by a clinician | Filled green, `check` |

In tight lists the mark is the icon alone in a small circle; wherever there is room it carries its full label.

## Style sheet

- **Surfaces:** a cool, slightly blue page (`--color-bg`) with white cards (`--color-surface`). One background family for the whole app.
- **Cards:** radius 16px, one soft shadow (`--shadow-card`), no border. A card holds a set; rows inside are split by a hairline. No cards inside cards. In dark mode there is no shadow and the card is a lighter surface.
- **Icon tiles:** 40px rounded square (32px in tight spots) in the type's soft tint with the icon in the type's hue.
- **Colour roles:** blue (`--color-primary`) for buttons, the active tab and links. Green for verified and for calling a contact. Amber for patient-entered and for "not read" notices. Red for allergies, destructive actions and the emergency header. Tints are soft; only the primary button, the verified mark and the emergency header are solid.
- **Controls:** pill-shaped buttons, chips and marks. Fields have 10px corners and a hairline border. Two button heights: 48px and 44px. One filled primary button per screen.
- **Navigation:** five items; the active one is blue with a soft blue pill behind its icon; Add is a raised blue circle in the middle.
- **Type:** Atkinson Hyperlegible Next for everything, weights 400 to 700; Atkinson Hyperlegible Mono only for text copied from a scanned page. Chosen because readers are often older and are reading medicine names and doses, where mistaking a letter or digit matters.
- **Numbers:** tabular figures, always with their unit.
- **Motion:** press feedback 150ms, state changes 200ms, ease out. Nothing animates on page load. Honour reduced motion.
- **Not used:** gradients, glass, emoji, illustrations, mascots, bright saturated fills.

## Tokens

The values live in `src/styles/tokens.css`, copied from the top of `docs/design/mockups/mock.css`.

Type sizes: 13, 15, 17, 20, 24, 30px (`--text-xs` to `--text-2xl`). Body is 17px.
Spacing: 4, 8, 12, 16, 24, 32, 48, 64px (`--space-1` to `--space-8`).
Radius: 10px (`--radius-sm`), 16px (`--radius-md`), pill (`--radius-pill`).

## Screen notes

- **Home:** greeting with the patient's initials, three shortcuts (scan a document, share with a doctor, emergency card), then what needs attention, then the summary as one card per group. The caution line appears once, under the reminder list.
- **Timeline:** filter chips, then one card per year; each row has its type tile, title, date and provider, and its trust mark.
- **Scan confirm:** the scanned page on top, a progress bar ("Record 2 of 3"), then one record to check. A field that was not read is an empty amber dashed box with a notice under it.
- **Clinician view:** no navigation. Patient card with when the link ends, a key to the three marks, then records with "Mark as verified" on each.
- **Emergency card:** red header with the name, blood type as the largest thing on the screen, allergies in a red-tinted card, a Call button beside each contact.

## What was not done

- The Craftwork catalog could not be searched because its connector is not authorised. The direction follows the skill's taste rules, and the typeface was checked in rendered screenshots.
