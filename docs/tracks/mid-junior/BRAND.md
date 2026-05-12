# Speedboat starter design system (take-home edition)

A stylized, take-home-only brand direction. Don't worry about matching
the real Parasail marketing site. Use this as a starting point, then
make the product experience coherent. Where you extend, simplify, or
push back on it, write down what you changed and why in your design
rationale.

## Voice & tone

- **Direct, technical, calm.** Speedboat is for developers who don't
  want marketing fluff. Sentences are short. Jargon is fine when it's
  load-bearing; not when it's decoration.
- **Helpful, not hype.** "Deploy a model in 4 steps" beats "Unleash
  the power of AI."
- **Honest about state.** When something is slow, or a feature is
  half-shipped, say so in the UI.
- **No emojis in product UI.** Marketing site, sure. Product surfaces,
  no.

Examples:

| Don't | Do |
|---|---|
| "🚀 Your model is ready to ship!" | "Deployment ready. Endpoint: …" |
| "Oops! Something went wrong." | "Couldn't reach the deployment service. Retry?" |
| "Powered by best-in-class infrastructure." | (just don't write this in the product) |

## Color

A small palette. Use it as the default unless your chosen path needs a
clearer visual language. If you add another accent, make sure it earns
its place and explain why.

| Token | Light value | Dark value | Use |
|---|---|---|---|
| `bg.canvas` | `#FAFAF9` | `#0B0B0E` | Page background |
| `bg.surface` | `#FFFFFF` | `#15161B` | Cards, inputs, modals |
| `bg.subtle` | `#F4F4F2` | `#1C1D24` | Section dividers, subtle wells |
| `border.default` | `#E5E5E1` | `#2A2B33` | Hairlines, dividers, input borders |
| `border.strong` | `#CFCFC8` | `#3C3D47` | Hover states, focused borders |
| `text.primary` | `#0F0F12` | `#F5F5F4` | Body text |
| `text.secondary` | `#5C5C66` | `#A8A8B0` | Labels, captions, metadata |
| `text.tertiary` | `#8A8A93` | `#777780` | Help text, placeholders |
| `accent.primary` | `#1F5BFF` | `#5C84FF` | Primary CTAs, focus rings, active states |
| `accent.subtle` | `#E6EDFF` | `#1B2542` | CTA hover, link underlines |
| `state.success` | `#0E8C58` | `#2BB87A` | Confirmations, "running" status |
| `state.warning` | `#B25C00` | `#D88A2A` | Warnings, near-limit states |
| `state.danger` | `#C0241C` | `#E0584F` | Errors, destructive actions |

The accent's job is to draw the eye to *one* thing per view. If you
need more than that, tell us what information hierarchy required it.

## Type

Tight scale. Three families, picked to render well in a developer tool.

```
Display:   "Söhne", "Inter", system-ui, sans-serif
Body:      "Inter", system-ui, sans-serif
Mono:      "JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace
```

If you don't have access to Söhne, use Inter for both display and body
and pick a 600/700 weight differential to do the work display would
have done. Don't add a third sans family.

Scale (rem):

| Role | Size | Line-height | Weight |
|---|---|---|---|
| `display.xl` | 2.50 | 1.10 | 600 |
| `display.lg` | 2.00 | 1.15 | 600 |
| `heading.lg` | 1.50 | 1.25 | 600 |
| `heading.md` | 1.25 | 1.30 | 600 |
| `heading.sm` | 1.00 | 1.40 | 600 |
| `body.lg` | 1.00 | 1.55 | 400 |
| `body.md` | 0.875 | 1.55 | 400 |
| `body.sm` | 0.8125 | 1.50 | 400 |
| `mono.md` | 0.875 | 1.45 | 400 |
| `mono.sm` | 0.8125 | 1.45 | 400 |

Numbers in tables / dashboards use `mono.*` for alignment.

## Spacing & layout

Use a **4px base unit**. Allowed steps: 4, 8, 12, 16, 20, 24, 32, 40,
56, 80. Don't introduce in-between values.

Default content max-width: `72rem` (1152px). Single-column reading
content caps at `42rem` (672px).

Default radii: `0.375rem` for inputs/buttons, `0.625rem` for cards,
`0.875rem` for modals. No fully rounded surfaces other than avatars.

## Component starting points

These two primitives are intentionally specific because buttons and
inputs reveal a lot about product craft. Treat them as the default
contract. You may redesign them if your product direction needs it, but
the rationale should be explicit.

### Button

- Heights: `32px` (compact), `40px` (default), `48px` (large).
- Variants: `primary` (filled accent), `secondary` (border only),
  `ghost` (no chrome), `danger` (filled state.danger).
- Padding: `0 12px` compact, `0 16px` default, `0 24px` large.
- Always shows focus ring (`accent.primary`, 2px, 2px offset).
- Loading state replaces label with a spinner; **width does not
  collapse** (preserve the original width to avoid layout shift).
- Disabled = 40% opacity + no pointer events + no tooltip on the
  button itself (put the explanation adjacent if needed).

### Input (single-line text / select)

- Height: `40px` default, `32px` compact.
- Border: `1px solid border.default` resting; `border.strong` hover;
  `accent.primary` focus + 2px focus ring.
- Padding: `0 12px`.
- Label always above the input, never floating placeholder-as-label.
- Error state: `border.danger`, helper text in `text.danger`, no red
  fill (preserves contrast for the actual content).
- Placeholder is `text.tertiary`, never the same as the value.

You can introduce: typography styles, layout primitives, cards,
dialogs, banners, anything else you need. If you keep the button/input
contract, show how you designed around it. If you change it, show why
the change improves the experience.

## What we'll look at in your design rationale

- Did you use the starter components as-is, extend them, or replace
  them with a clear reason?
- Did your color choices respect contrast (≥4.5:1 for body text,
  ≥3:1 for non-text UI)?
- Did you stick to the spacing scale, or did you sprinkle 6/10/14px?
- Where did you extend the system, and why?

If you push back on any of the above, that's fine. Write the push-back
into your rationale. Designers who have opinions are good. Designers
who silently freelance are not.
