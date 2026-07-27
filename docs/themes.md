# Resume Themes

Themes are Handlebars templates that render a JSON Resume into styled HTML (then PDF).

## Location & registry

```
electron/themes/
├── index.ts            # Registry: themes map + ThemeName type
├── shared/render.ts    # Shared Handlebars rendering helpers
└── <theme-name>/
    ├── index.ts        # export const <camelName> = { template, styles }
    ├── resume.hbs      # Handlebars template
    └── style.css       # Theme CSS (imported with ?raw)
```

Existing themes: `modern-sidebar`, `spartan-fr`, `simple`, `professional`,
`compact`, `elegant`, `creative`, `minimal`, `bold`.

## A theme's `index.ts`

```typescript
import template from "./resume.hbs";
import styles from "./style.css?raw";

export const modernSidebar = { template, styles };
```

## Adding a theme (workflow)

1. Create `electron/themes/<theme-name>/` with `resume.hbs`, `style.css`, `index.ts`.
2. In `index.ts`, export `{ template, styles }` (import `.hbs` and `.css?raw`).
3. Register it in `electron/themes/index.ts`:
   - Import the export.
   - Add it to the `themes` map (the key is the theme name string used at runtime).
4. The `ThemeName` union updates automatically from the `themes` map keys.
5. Verify with the `resume:render-preview` IPC flow (see `docs/ipc.md`) via `npm run dev`.

## Handlebars helpers

`electron/themes/shared/render.ts` registers helpers available in **every** template:

| Helper | Use |
| ------ | --- |
| `safeImage` | Emit an image data URL without truncation (`SafeString`). |
| `paragraphSplit` | Split plaintext into `<p>` paragraphs. |
| `toLowerCase` | Lowercase a string. |
| `spaceToDash` | Replace spaces with dashes. |
| `MY` / `Y` / `DMY` | Format a date (month-year / year / day-month-year) via `moment`. |

Rendering goes through `renderTheme(themeName, resumeData)` in the same file.

## PDF constraints

Resumes are **multi-page by default**: content flows to its natural height across as
many A4 pages as needed (A4, zero margins), via Chromium's `printToPDF` with
`preferCSSPageSize: true`. One-page mode is an explicit, opt-in, JS-enforced user
choice — implemented by `generatePdf`'s shrink-to-fit `executeJavaScript` snippet
(`shared/pageFit.ts`), not by theme CSS. The same shrink-to-fit logic is duplicated,
identically, in `PreviewFrame.tsx` (live preview) and `generatePdf` (exported PDF) so the
two always match.

For sidebar-split layouts (a theme with both a `.sidebar` and a `.main-content` element
inside `.resume`, e.g. `modern-sidebar`), the one-page shrink applies only to
`.main-content` — the sidebar column is pinned to exactly one A4 page height and stays
unscaled, so it doesn't visually shrink along with the body. Themes without that
structure keep the simple whole-`body`-scale behavior.

Theme `style.css` must **not** reintroduce a fixed `height`/`overflow: hidden` clamp on
`html`/`body`/a top-level layout container inside `@media print` — that clamp
previously truncated multi-page PDF exports to page 1. New themes should let content
flow naturally and rely on `.entry`-style `break-inside: avoid-page` rules for clean
page breaks instead.

## Bundling

`forge.config.js` ships `electron/themes/` via `extraResource`, so themes are available
in packaged builds.
