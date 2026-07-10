---
name: add-resume-theme
description: Use when adding or editing a resume theme in WorkLooking — creating a Handlebars template under electron/themes/, writing resume.hbs + style.css, or registering a theme in electron/themes/index.ts. Front-load keywords: resume theme, Handlebars, resume.hbs, style.css, electron/themes, ThemeName, theme registry, CV template.
---

# Add a resume theme

Full reference: [`docs/themes.md`](../../../docs/themes.md). This skill is the step list.

Themes render a JSON Resume into styled HTML (then a one-page A4 PDF).

## Steps

1. **Create the theme folder** `electron/themes/<theme-name>/` with three files:
   - `resume.hbs` — the Handlebars template (model an existing one, e.g. `modern-sidebar/resume.hbs`).
   - `style.css` — the theme styles. Target **one A4 page**, scale 1.0, zero margins.
   - `index.ts` — export the theme object.

2. **Write `index.ts`** exactly in this shape (`.css` imported with `?raw`):
   ```typescript
   import template from "./resume.hbs";
   import styles from "./style.css?raw";

   export const themeCamelName = { template, styles };
   ```

3. **Register it** in `electron/themes/index.ts`:
   - `import { themeCamelName } from "./<theme-name>";`
   - Add `"<theme-name>": themeCamelName,` to the `themes` map.
   - The `ThemeName` union updates automatically from the map keys — no manual type edit.

4. **Bundling is automatic:** `forge.config.js` ships `electron/themes/` via `extraResource`.

## Verify

- `npm run typecheck` (`strict`).
- `npm test` — keep `electron/themes/shared/render.test.ts` (registry parity /
  renders each theme) green; add the new theme to its expected list.
- `npm run dev`, then preview the theme through the `resume:render-preview` flow
  (see [`docs/ipc.md`](../../../docs/ipc.md)). Confirm the PDF stays on **one A4 page**.

## Rules

- Match the existing themes' Handlebars variable names so any resume renders.
- Do not hardcode PII; the template renders whatever resume JSON is passed in.
