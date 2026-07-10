import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Unmount React trees and reset the DOM between renderer tests.
afterEach(() => {
  cleanup();
  localStorage.clear();
});
