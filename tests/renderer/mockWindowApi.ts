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

type Unsubscribe = () => void;

export function installMockWindowApi() {
  const invoke = vi.fn();
  // Default: register nothing and hand back a no-op unsubscribe. Tests can
  // override with `on.mockImplementation((channel, cb) => …)` to capture
  // listeners and drive events.
  const on = vi.fn(
    (_channel: string, _callback: (data: unknown) => void): Unsubscribe =>
      () => {},
  );
  const once = vi.fn();

  window.api = { invoke, on, once } as unknown as typeof window.api;

  return { invoke, on, once };
}
