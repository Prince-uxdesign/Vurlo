# Vurlo Design System

**Companion to:** PRD 1.0, Section 36 (Visual Direction) — read both together. This file is the implementation-level detail; the PRD is the intent.
**Audience:** This file is written to be read directly by coding agents (Claude Code, Muse Spark, Gemini Flash, or any other agent working on this repo). Every value below is a literal implementation value, not a suggestion to interpret or approximate. If a token conflicts with something in generated code, this file wins — flag the conflict instead of silently picking one.
**Stack assumption:** Next.js / React / TypeScript / Tailwind-compatible CSS, per PRD Section 39.

---

## 1. Design intent (read this once, then use the tokens)

Vurlo is a focused utility, not an enterprise suite — PRD Section 2 and 7 are explicit about that. The design system follows from that:

- **Black carries structure.** Navigation, body copy, primary text, borders, the logo. Confident and utilitarian, not decorative.
- **Orange is rationed.** It marks the moments that matter — the one primary action per screen, active status, analytics highlights — never a page wash or a background tint.
- **One typeface family does almost everything.** A second, monospace family is reserved specifically for literal short URLs and slugs, because those are actually code-like strings — not for generic labels.
- **Boldness is spent in one place.** The glossy button treatment belongs to a single primary CTA per view. Everything else stays flat and quiet so that CTA reads as special.
- **Shape carries hierarchy, not just color.** The primary CTA is the only fully-pill-shaped button. Standard controls use a smaller, non-pill radius. This means hierarchy survives even in grayscale.

A short "avoid" list is at the end of this document (Section 12) — it exists because generic AI-generated interfaces converge on a specific, recognizable set of defaults (tracked-out caps eyebrows, one soft grey shadow under every card, a near-black standing in for real black, arrows appended to every button). Read it before generating any UI.

---

## 2. Color

### 2.1 Neutrals (warm-tinted — not cold blue-grays)

| Token | Hex | Role |
|---|---|---|
| `--color-paper` | `#FBFAF8` | Page background, base surface |
| `--color-mist-100` | `#F3F1EE` | Subtle fills — hover backgrounds, table stripe, ghost-button hover |
| `--color-mist-300` | `#E3DFDA` | Borders, dividers, input borders |
| `--color-stone-500` | `#948C82` | Placeholder text, disabled text/icons **only** — not for anything that must reliably be read |
| `--color-slate-700` | `#4A443C` | Secondary/body-muted text — used wherever "secondary text" is called for |
| `--color-ink-900` | `#000000` | Primary text, primary UI chrome, the logo. This **is** the brand black — true black, not a tinted near-black. |
| `--color-surface-dark` | `#171310` | Large dark-fill surfaces only (footer, dark sections). A deliberately warm dark neutral, not a stand-in for `ink-900` — never use this where the spec says "black." |

### 2.2 Orange

| Token | Hex | Role |
|---|---|---|
| `--color-ember-700` | `#C2410C` | Default functional orange — solid button fills with white text, links, icons on white. Passes WCAG AA (~5:1) with white text. |
| `--color-ember-600` | `#D14A0A` | Hover state for ember-700 fills |
| `--color-blaze-500` | `#F97316` | Bright accent **only** — small badges, chart lines, icon accents, the top highlight in gradients. Never as a text color on white at normal body size (fails AA), never as a large solid fill behind white text. |
| `--color-blaze-200` | `#FBD3AE` | Light tint — hover backgrounds on orange elements, badge fills paired with dark text |
| `--glow-ember` | `rgba(194, 65, 12, 0.45)` | Ambient shadow color, used only under the primary CTA |

### 2.3 Semantic (status, not brand)

| Token | Hex | Role |
|---|---|---|
| `--color-success-700` | `#15803D` | "Active" link status only |
| `--color-danger-700` | `#B91C1C` | Destructive actions (delete confirmation), error states, form validation errors |

Everything else on the status spectrum (Expired, Disabled, Archived) uses the **neutral** family, not a new hue — see Section 6. This is deliberate: those are "off" states, not alarms, and it keeps the palette disciplined instead of accumulating a color per status.

---

## 3. Typography

### 3.1 Typefaces

**Primary (display + UI + body): Schibsted Grotesk.**
A grotesk sans from Schibsted (the Norwegian media group), open-sourced and hosted on Google Fonts. Chosen deliberately over the defaults that read as templated right now — Inter, Geist, Space Grotesk, Poppins, DM Sans are all extremely common in AI-generated and template UI. Schibsted Grotesk has real character in its lowercase `a` and `g` and diagonal terminals, a genuinely wide weight range (400–900, variable), and is still uncommon enough in product UI that it doesn't read as a default choice. One family carries both marketing headlines and in-app UI, differentiated by weight and size — per the design principle that you don't need two families unless they're doing clearly different jobs.

*Alternative, if you want more editorial/premium flavor:* **Switzer** (Fontshare, self-hosted — not on Google Fonts, requires downloading font files into the repo). Same token structure applies; just swap the font-family value.

**Monospace (short URLs, slugs, link IDs only): IBM Plex Mono.**
Used exclusively where the content is actually a code-like string — a short link, a slug, a link ID in a table. This is a content-grounded use of monospace, not decoration: do not use it for generic small labels, metadata, or timestamps. That's a common generic-AI-UI tell (see Section 12).

### 3.2 Implementation (Next.js)

```ts
import { Schibsted_Grotesk, IBM_Plex_Mono } from 'next/font/google'

export const fontDisplay = Schibsted_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700', '800'],
})

export const fontMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600'],
})
```

Fallback stack: `"Schibsted Grotesk", -apple-system, "Segoe UI", sans-serif` and `"IBM Plex Mono", ui-monospace, "SF Mono", monospace`.

### 3.3 Type scale

| Token | Size / Line-height | Tracking | Weight | Use |
|---|---|---|---|---|
| `--text-display-xl` | 64px / 1.05 | -0.02em | 700 | Marketing hero headline (desktop) |
| `--text-display-xl-mobile` | 38px / 1.1 | -0.01em | 700 | Marketing hero headline (mobile) |
| `--text-display-l` | 44px / 1.1 | -0.015em | 700 | Section headlines, marketing page titles |
| `--text-h1` | 32px / 1.2 | -0.01em | 700 | In-app page heading (e.g. "Links") |
| `--text-h2` | 24px / 1.25 | -0.005em | 600 | Section heading within a page |
| `--text-h3` | 18px / 1.3 | 0 | 600 | Card/subsection heading |
| `--text-body-l` | 18px / 1.6 | 0 | 400 | Marketing body copy, lede paragraphs |
| `--text-body` | 15px / 1.6 | 0 | 400–450 | Default UI and body text |
| `--text-small` | 13px / 1.5 | 0.01em | 400 | Meta text, captions, table cells |
| `--text-label` | 14px / 1.2 | 0 | 600 | Form labels, button labels — **sentence case, never uppercase** |
| `--text-mono` | 14–15px / 1.4 | 0 | 500 | Short URLs, slugs, link IDs — `--font-mono` |

Keep body line lengths under ~80 characters. Never track out a label in all caps (Section 12) — use weight and color to distinguish a label from content instead.

---

## 4. Buttons

Four variants. Only **one** — Primary — carries the glossy treatment. It exists for exactly one action per screen (the main "Create link" CTA, "Save," a single dominant action). Everything else is deliberately flat so the primary action keeps its weight.

### 4.1 Primary (glossy)

```css
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: var(--radius-pill); /* 999px */
  font: 600 15px/1.2 var(--font-display);
  color: #FFFFFF;
  background: linear-gradient(180deg, #E2600E 0%, #C2410C 55%, #AD380A 100%);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.35),   /* glass sheen along the top edge */
    inset 0 -6px 10px rgba(0, 0, 0, 0.12),      /* depth toward the bottom */
    0 8px 20px -4px var(--glow-ember);          /* ambient glow beneath */
  transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
}

.btn-primary:hover {
  background: linear-gradient(180deg, #EA6C1A 0%, #D14A0A 55%, #B23A0A 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    inset 0 -6px 10px rgba(0, 0, 0, 0.14),
    0 10px 26px -4px rgba(194, 65, 12, 0.55);
}

.btn-primary:active {
  transform: scale(0.98);
  background: #AD380A;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.25);
}

.btn-primary:focus-visible {
  outline: 2px solid #000000;
  outline-offset: 2px;
}

.btn-primary:disabled {
  background: var(--color-mist-300);
  color: var(--color-stone-500);
  box-shadow: none;
  cursor: not-allowed;
}
```

**Why this reads as "glossy":** the base fill is a vertical gradient that lightens toward the top (mimicking a curved, lit surface), an inset highlight along the top edge adds the glass-like sheen, and a soft colored glow sits underneath rather than a generic grey shadow. The text always sits against the accessible `ember-700`-range portion of the gradient, not the brighter `blaze-500` — that's reserved for the highlight only, so contrast holds even though the button reads as vivid.

**Split-button variant** (icon + label + chevron, as in the reference):

```css
.btn-primary .icon-chip {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.18);
}

.btn-primary .divider {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.28);
}
```

### 4.2 Secondary (flat, bordered)

```css
.btn-secondary {
  padding: 11px 22px;
  border-radius: var(--radius-md); /* 10px — intentionally not a pill */
  font: 600 15px/1.2 var(--font-display);
  color: #000000;
  background: transparent;
  border: 1.5px solid #000000;
}
.btn-secondary:hover { background: rgba(0, 0, 0, 0.05); }
.btn-secondary:active { background: rgba(0, 0, 0, 0.09); }
.btn-secondary:focus-visible { outline: 2px solid var(--color-ember-700); outline-offset: 2px; }
.btn-secondary:disabled { border-color: var(--color-mist-300); color: var(--color-stone-500); }
```

### 4.3 Ghost / tertiary

```css
.btn-ghost {
  padding: 11px 16px;
  border-radius: var(--radius-md);
  color: #000000;
  background: transparent;
  border: none;
}
.btn-ghost:hover { background: var(--color-mist-100); }
```

### 4.4 Destructive

```css
.btn-destructive {
  padding: 11px 22px;
  border-radius: var(--radius-md); /* not a pill — pill is reserved for the primary positive action */
  color: var(--color-danger-700);
  background: transparent;
  border: 1.5px solid var(--color-danger-700);
}
.btn-destructive:hover { background: var(--color-danger-700); color: #FFFFFF; }
```

---

## 5. Inputs

```css
.input {
  padding: 10px 14px;
  border-radius: var(--radius-md); /* 10px */
  border: 1px solid var(--color-mist-300);
  background: #FFFFFF;
  font: 400 15px/1.4 var(--font-display);
  color: #000000;
}
.input::placeholder { color: var(--color-stone-500); }
.input:focus-visible { outline: 2px solid #000000; outline-offset: 1px; border-color: transparent; }
.input.error { border-color: var(--color-danger-700); }
```

Error messages sit below the field in `--text-small`, `--color-danger-700`, with an icon — never color alone (PRD Section 38).

---

## 6. Status badges

Maps directly to PRD Section 18 (Link Lifecycle). Per Section 38's accessibility requirement — no information by color alone — every badge pairs its color with a distinct icon, not color alone.

| Status | Background | Text | Icon |
|---|---|---|---|
| Active | `rgba(21,128,61,0.1)` | `--color-success-700` | filled dot |
| Expired | `--color-mist-100` | `--color-slate-700` | clock |
| Disabled | `--color-mist-100` | `--color-slate-700` | pause |
| Archived | `--color-mist-100` | `--color-slate-700` | archive box |
| Deleted | — (not shown as a badge; referenced in logs only) | `--color-danger-700` | — |

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  font: 600 13px/1.2 var(--font-display);
}
```

Note Expired, Disabled, and Archived intentionally share the same neutral gray treatment — they're "off" states, not alarms. They're told apart by icon and label, not by inventing a new color per status.

---

## 7. Cards & surfaces

Most surfaces (link rows, dashboard cards) use a **1px border, no shadow** — relying on the border and background contrast for definition rather than a drop shadow on every card. Shadow is reserved for things that are genuinely elevated (Section 8).

```css
.card {
  background: #FFFFFF;
  border: 1px solid var(--color-mist-300);
  border-radius: var(--radius-lg); /* 14px */
  padding: 20px;
}
```

---

## 8. Elevation

| Token | Value | Use |
|---|---|---|
| `--shadow-none` | none | Default for cards, table rows, most surfaces |
| `--shadow-float` | `0 4px 16px rgba(0,0,0,0.08)` | Dropdowns, tooltips, popovers |
| `--shadow-modal` | `0 24px 48px rgba(0,0,0,0.18)` | Modals, dialogs |
| `--glow-primary` | `0 8px 20px -4px var(--glow-ember)` | Primary button only |

---

## 9. Radius scale

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 8px | Icon chips, small controls |
| `--radius-md` | 10px | Inputs, secondary/ghost/destructive buttons |
| `--radius-lg` | 14px | Cards, panels |
| `--radius-xl` | 20px | Modals |
| `--radius-pill` | 999px | Primary CTA button and status badges **only** |

Deliberately not one radius for everything — the primary button's pill shape is part of what makes it read as the special action, and that only works if nothing else uses the same shape.

---

## 10. Spacing

Base unit 4px: `4, 8, 12, 16, 24, 32, 48, 64, 96`. Use the scale rather than arbitrary values.

---

## 11. Iconography & motion

**Icons:** Lucide (outline style, 1.5–1.75px stroke, 20/24px sizing) as the default set — open-source, wide coverage, pairs well with the grotesk's geometric precision. Not mandatory, but stay consistent: don't mix icon sets within the product.

**Motion:** 120–160ms ease for hover/press micro-interactions (buttons, inputs). 200–240ms ease-out for panel/modal entrances. Skip staggered fade-and-slide-up reveals on scroll — that's a generic tell (Section 12). The one place worth a genuinely orchestrated animated moment is the link-creation success state (PRD Section 13 calls for "a clear success state, not merely a toast") — spend the motion budget there, keep everything else quiet.

---

## 12. Explicit avoid-list

- Don't fake black with a tinted near-black (`#0B0B0B`, `#111`). Use true `#000000` (`ink-900`) — or the explicitly-named `surface-dark` for large dark fills, never an in-between "off-black."
- Don't put the same border-radius on every component. Follow Section 9 — pill is reserved for the primary CTA and badges only.
- Don't put the same soft grey shadow under every card. Most surfaces use a border, not a shadow (Section 7–8).
- Don't add a tracked-out ALL-CAPS eyebrow label above headings.
- Don't join meta text with middle dots (`A · B · C`) or build labels as `WORD — fragment` with a spaced em dash.
- Don't append an arrow (→) to button or link text — "Create link," not "Create link →."
- Don't use monospace for generic small labels or timestamps — it's reserved for literal short URLs, slugs, and link IDs (Section 3.1).
- Don't accent a single word in a headline with italic, bold, or a different color for emphasis.
- Don't apply the glossy gradient treatment to more than one button per view.
- Don't default to a warm cream background with a terracotta accent, or a near-black background with a single acid accent — neither is this system.

---

## 13. Token summary (CSS custom properties)

```css
:root {
  /* Neutrals */
  --color-paper: #FBFAF8;
  --color-mist-100: #F3F1EE;
  --color-mist-300: #E3DFDA;
  --color-stone-500: #948C82;
  --color-slate-700: #4A443C;
  --color-ink-900: #000000;
  --color-surface-dark: #171310;

  /* Orange */
  --color-ember-700: #C2410C;
  --color-ember-600: #D14A0A;
  --color-blaze-500: #F97316;
  --color-blaze-200: #FBD3AE;
  --glow-ember: rgba(194, 65, 12, 0.45);

  /* Semantic */
  --color-success-700: #15803D;
  --color-danger-700: #B91C1C;

  /* Radius */
  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --radius-pill: 999px;

  /* Fonts */
  --font-display: "Schibsted Grotesk", -apple-system, "Segoe UI", sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, "SF Mono", monospace;
}
```
