/**
 * Node `require` hooks that let `scripts/verify-multipage-pdf.ts` import the
 * real theme modules (`electron/themes/*/index.ts`) outside of Vite/Vitest.
 *
 * Those modules do:
 *   import template from "./resume.hbs";
 *   import styles from "./style.css?raw";
 *
 * Vite (used by the app build) and Vitest (used by `npm test`, via
 * `vitest.config.ts`'s `rawLoader` plugin) both know how to turn `.hbs` files
 * and `?raw`-suffixed imports into plain strings. Plain Node + `tsx` (used by
 * `npm run verify:pdf`, which boots a real Electron process instead of a
 * Vite/Vitest pipeline) does not, by default: it has no loader for `.hbs` at
 * all, and treats the literal `?raw` query string as part of the module
 * specifier, so `require("./style.css?raw")` fails to resolve.
 *
 * This file mirrors `vitest.config.ts`'s `rawLoader` transform for the plain
 * CJS `require()` pipeline `tsx/cjs` uses:
 *   - Strip a trailing `?raw` from any request before resolving it, so
 *     `./style.css?raw` resolves to the real `./style.css` file.
 *   - Register `.css`/`.hbs` extension handlers that export the file's raw
 *     text content as the module's `exports`, exactly like `?raw` imports /
 *     the `rawLoader` plugin's `.hbs` handling do.
 *
 * Loaded via `-r ./scripts/register-raw-loaders.cjs` (before the `tsx`-loaded
 * entry script) in the `verify:pdf` npm script, so these hooks are active
 * before `electron/themes/*` is ever required.
 */
const Module = require("module");
const fs = require("fs");

const RAW_SUFFIX = "?raw";
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveFilenameWithRawSupport(
  request,
  ...args
) {
  if (request.endsWith(RAW_SUFFIX)) {
    const bareRequest = request.slice(0, -RAW_SUFFIX.length);
    return originalResolveFilename.call(this, bareRequest, ...args);
  }
  return originalResolveFilename.call(this, request, ...args);
};

function rawTextLoader(mod, filename) {
  mod.exports = fs.readFileSync(filename, "utf8");
}

require.extensions[".css"] = rawTextLoader;
require.extensions[".hbs"] = rawTextLoader;
