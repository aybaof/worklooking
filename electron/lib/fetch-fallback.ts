/**
 * Decide whether a `fetch_url` hidden-window attempt should fall back to a
 * visible `BrowserWindow` so the user can complete an interactive login.
 *
 * Pure and side-effect-free so it can be unit-tested without mocking
 * `BrowserWindow`/timers — mirrors the style of `auth-detect.ts`.
 *
 * @param reasons.hiddenLoadTimedOut Whether the hidden attempt's initial
 *   `loadURL` failed to settle within the hidden-load timeout (treated as
 *   "stuck", e.g. a WebAuthn/security-key hang).
 * @param reasons.needsAuth Whether `detectsAuthRequired()` flagged the
 *   (successfully) loaded hidden page as a login page.
 */
export function shouldFallBackToVisible(reasons: {
  hiddenLoadTimedOut: boolean;
  needsAuth: boolean;
}): boolean {
  return reasons.hiddenLoadTimedOut || reasons.needsAuth;
}
