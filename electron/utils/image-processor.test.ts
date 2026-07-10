/**
 * Tier 4 — image-processor (fs + sharp).
 *
 * Needs a small real image fixture at tests/fixtures/sample.png.
 * See tests/TEST_PLAN.md → "Tier 4: image-processor".
 */
import { describe, it } from "vitest";
// import { processImage } from "./image-processor";

describe("processImage", () => {
  it.todo("resizes a fixture image to <=200px and returns a base64 JPEG dataURL");
  it.todo("returns { success: false, error } for a missing file");
  it.todo("returns { success: false, error } for a non-image file");
});
