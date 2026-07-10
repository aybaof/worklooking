/**
 * Heuristically decide whether a fetched page requires authentication.
 *
 * Conservative by design: it only returns `true` when reasonably confident,
 * to avoid falsely blocking normal navigations.
 *
 * @param initialUrl The URL that was originally requested.
 * @param finalUrl The URL the browser landed on (after redirects).
 * @param pageTitle The title of the loaded page.
 */
export function detectsAuthRequired(
  initialUrl: string,
  finalUrl: string,
  pageTitle: string,
): boolean {
  // Conservative detection: only flag if we're very confident
  const finalUrlLower = finalUrl.toLowerCase();
  const titleLower = pageTitle.toLowerCase();

  // Check 1: Explicit auth paths in URL
  const authPaths = ["/login", "/signin", "/sign-in", "/auth", "/authenticate"];
  if (authPaths.some((p) => finalUrlLower.includes(p))) {
    return true;
  }

  // Check 2: Redirected to different domain with "login" in it
  try {
    const initialDomain = new URL(initialUrl).hostname;
    const finalDomain = new URL(finalUrl).hostname;
    if (
      initialDomain !== finalDomain &&
      (finalUrlLower.includes("login") || finalUrlLower.includes("signin"))
    ) {
      return true;
    }
  } catch {
    // Invalid URL, ignore this check
  }

  // Check 3: Page title explicitly mentions login/sign in
  if (
    titleLower.includes("sign in") ||
    titleLower.includes("log in") ||
    titleLower === "login"
  ) {
    return true;
  }

  return false; // Conservative: if unsure, assume no auth needed
}
