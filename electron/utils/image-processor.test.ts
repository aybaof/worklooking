/**
 * Tier 4 — image-processor (fs + sharp).
 *
 * Uses real checked-in fixtures:
 *   tests/fixtures/sample.png       — a 400x300 PNG (exercises the resize)
 *   tests/fixtures/not-an-image.txt — plain text (exercises error handling)
 * See tests/TEST_PLAN.md → "Tier 4: image-processor".
 */
import { describe, it, expect } from "vitest";
import * as path from "path";
import { processImage } from "./image-processor";

const FIXTURES = path.resolve(__dirname, "../../tests/fixtures");
const SAMPLE_PNG = path.join(FIXTURES, "sample.png");
const NOT_AN_IMAGE = path.join(FIXTURES, "not-an-image.txt");

/** Parse a `data:image/jpeg;base64,...` URL back into raw bytes. */
function decodeDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error(`not a base64 data URL: ${dataUrl.slice(0, 32)}…`);
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
}

describe("processImage", () => {
  it("resizes a fixture image to <=200px and returns a base64 JPEG dataURL", async () => {
    const result = await processImage(SAMPLE_PNG);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(typeof result.dataUrl).toBe("string");
    expect(result.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(result.originalSize).toBeGreaterThan(0);
    expect(result.optimizedSize).toBeGreaterThan(0);

    // Decode the produced JPEG and confirm it was resized within bounds.
    const { mime, buffer } = decodeDataUrl(result.dataUrl!);
    expect(mime).toBe("image/jpeg");

    // Re-read metadata via sharp to assert the 200px cap + JPEG format.
    const sharp = (await import("sharp")).default;
    const meta = await sharp(buffer).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBeLessThanOrEqual(200);
    expect(meta.height).toBeLessThanOrEqual(200);
    // Aspect ratio of the 400x300 source is preserved (landscape → width caps first).
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(150);
  });

  it("returns { success: false, error } for a missing file", async () => {
    const missing = path.join(FIXTURES, "does-not-exist.png");
    const result = await processImage(missing);

    expect(result.success).toBe(false);
    expect(result.dataUrl).toBeUndefined();
    expect(result.error).toMatch(/Failed to process image:/);
  });

  it("returns { success: false, error } for a non-image file", async () => {
    const result = await processImage(NOT_AN_IMAGE);

    expect(result.success).toBe(false);
    expect(result.dataUrl).toBeUndefined();
    expect(result.error).toMatch(/Failed to process image:/);
  });
});
