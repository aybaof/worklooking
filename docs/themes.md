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

Generated resumes target **one A4 page** (A4, scale 1.0, zero margins), handled by the
app's PDF generation. Design `style.css` accordingly.

## Bundling

`forge.config.js` ships `electron/themes/` via `extraResource`, so themes are available
in packaged builds.
