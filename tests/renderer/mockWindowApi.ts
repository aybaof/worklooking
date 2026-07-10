/**
 * Helper for renderer hook tests: installs a mock `window.api`
 * (invoke / on / once) so hooks that call IPC can be tested without Electron.
 *
 * TODO (implementing agent): flesh this out. Keep the shape in sync with
 * `src/electron.d.ts` and `electron/preload.ts`. Example intended usage:
 *
 *   const api = installMockWindowApi();
 *   api.invoke.mockResolvedValueOnce({ html: "<div/>" });
 *   // ...render hook, act, assert api.invoke was called with the channel...
 *
 * Return the vi.fn() mocks so tests can set return values and assert calls.
 */
import { vi } from "vitest";

export function installMockWindowApi() {
  const invoke = vi.fn();
  const on = vi.fn(() => () => {}); // returns an unsubscribe fn
  const once = vi.fn();

  // @ts-expect-error test-only global assignment
  window.api = { invoke, on, once };

  return { invoke, on, once };
}
