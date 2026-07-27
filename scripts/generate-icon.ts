/**
 * One-off, manually-run tool that regenerates `electron/icon.ico` as a proper
 * multi-resolution Windows ICO (16/32/48/256px, 32bpp RGBA), resampled from
 * the file's own existing single embedded frame using `sharp`.
 *
 * Background: `electron/icon.ico` previously contained only one 128x128
 * frame. Windows shell icon resolution (Explorer, shortcuts, taskbar) expects
 * a multi-resolution `.ico` with the standard size set; a single-resolution
 * source is the leading cause of the installed app/shortcuts showing the
 * generic Electron icon instead of WorkLookingAgent's own icon. See
 * `.work/features/installer-icon-fix/` for the full investigation/spec/plan.
 *
 * This is intentionally NOT a Vitest test and is NOT wired into `npm test`/CI
 * (mirrors `scripts/verify-multipage-pdf.ts`'s "documented manual tool"
 * pattern): it is a regeneration step to be re-run only if the source art or
 * target sizes ever change again in the future.
 *
 * `sharp`/libvips has no guaranteed ICO decoder, so this script manually
 * parses the existing ICO container to extract the single embedded frame
 * (branching on whether that frame is PNG-compressed or a raw
 * BITMAPINFOHEADER-style DIB), decodes it via `sharp`, resizes it to the
 * target sizes as PNG buffers, and hand-assembles a valid multi-frame ICO
 * container from those buffers (PNG-compressed ICO frames are valid on
 * Windows Vista+, so no BMP-DIB encoding is needed for the output either).
 *
 * Run with:
 *   npm run generate:icon
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const ICON_PATH = path.join(__dirname, "..", "electron", "icon.ico");
const TARGET_SIZES = [16, 32, 48, 256] as const;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

interface IconDirEntry {
  width: number;
  height: number;
  bitCount: number;
  bytesInRes: number;
  imageOffset: number;
}

/** Parses the 6-byte ICONDIR header + ICONDIRENTRY records of a `.ico` file. */
function parseIconDir(buffer: Buffer): IconDirEntry[] {
  const reserved = buffer.readUInt16LE(0);
  const type = buffer.readUInt16LE(2);
  const count = buffer.readUInt16LE(4);
  if (reserved !== 0 || type !== 1) {
    throw new Error(
      `Unexpected ICONDIR header (reserved=${reserved}, type=${type}); not a valid .ico file`,
    );
  }

  const entries: IconDirEntry[] = [];
  for (let i = 0; i < count; i++) {
    const offset = 6 + i * 16;
    const rawWidth = buffer.readUInt8(offset);
    const rawHeight = buffer.readUInt8(offset + 1);
    const bitCount = buffer.readUInt16LE(offset + 6);
    const bytesInRes = buffer.readUInt32LE(offset + 8);
    const imageOffset = buffer.readUInt32LE(offset + 12);
    entries.push({
      // A stored byte of 0 for width/height encodes 256 per the ICO spec.
      width: rawWidth === 0 ? 256 : rawWidth,
      height: rawHeight === 0 ? 256 : rawHeight,
      bitCount,
      bytesInRes,
      imageOffset,
    });
  }
  return entries;
}

/**
 * Decodes a raw BITMAPINFOHEADER-style DIB frame (as embedded in classic
 * `.ico` files: 40-byte info header, no `BM` file header, bottom-up BGRA
 * pixel array followed by an AND mask we don't need) into a top-down RGBA
 * buffer sharp can consume via its `raw` input option.
 */
function decodeDibFrame(frame: Buffer): { data: Buffer; width: number; height: number } {
  const biSize = frame.readUInt32LE(0);
  if (biSize !== 40) {
    throw new Error(`Unsupported DIB header size ${biSize}; expected 40 (BITMAPINFOHEADER)`);
  }
  const width = frame.readInt32LE(4);
  // ICO DIB height is doubled (color data + AND mask); the real image height
  // is half of the stored value.
  const height = frame.readInt32LE(8) / 2;
  const bitCount = frame.readUInt16LE(14);
  if (bitCount !== 32) {
    throw new Error(`Unsupported DIB bit count ${bitCount}; only 32bpp BGRA is supported`);
  }

  const pixelDataStart = 40;
  const rowBytes = width * 4;
  const rgba = Buffer.alloc(width * height * 4);

  // Source rows are stored bottom-up; convert to top-down RGBA.
  for (let row = 0; row < height; row++) {
    const srcRowStart = pixelDataStart + (height - 1 - row) * rowBytes;
    const dstRowStart = row * rowBytes;
    for (let col = 0; col < width; col++) {
      const srcPixel = srcRowStart + col * 4;
      const dstPixel = dstRowStart + col * 4;
      const b = frame.readUInt8(srcPixel);
      const g = frame.readUInt8(srcPixel + 1);
      const r = frame.readUInt8(srcPixel + 2);
      const a = frame.readUInt8(srcPixel + 3);
      rgba.writeUInt8(r, dstPixel);
      rgba.writeUInt8(g, dstPixel + 1);
      rgba.writeUInt8(b, dstPixel + 2);
      rgba.writeUInt8(a, dstPixel + 3);
    }
  }

  return { data: rgba, width, height };
}

/** Extracts and decodes the single embedded frame of an existing `.ico` file into a PNG buffer. */
async function extractSourcePng(icoBuffer: Buffer): Promise<Buffer> {
  const entries = parseIconDir(icoBuffer);
  if (entries.length === 0) {
    throw new Error("Source .ico has no embedded frames");
  }
  const entry = entries[0];
  const frame = icoBuffer.subarray(entry.imageOffset, entry.imageOffset + entry.bytesInRes);

  const isPng = frame.subarray(0, 8).equals(PNG_SIGNATURE);
  if (isPng) {
    console.log("Detected source frame format: PNG-compressed");
    return sharp(frame).png().toBuffer();
  }

  console.log("Detected source frame format: raw BITMAPINFOHEADER DIB (BGRA)");
  const { data, width, height } = decodeDibFrame(frame);
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

/** Hand-assembles a multi-frame ICO container from PNG-compressed frame buffers. */
function assembleIco(frames: Array<{ size: number; png: Buffer }>): Buffer {
  const headerSize = 6;
  const entrySize = 16;
  const dirSize = headerSize + entrySize * frames.length;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(frames.length, 4); // image count

  const entryBuffers: Buffer[] = [];
  let runningOffset = dirSize;
  for (const { size, png } of frames) {
    const entry = Buffer.alloc(entrySize);
    // A width/height byte of 0 encodes 256 per the ICO spec.
    entry.writeUInt8(size === 256 ? 0 : size, 0);
    entry.writeUInt8(size === 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // color count (0 = no palette / >= 8bpp)
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8); // size of image data in bytes
    entry.writeUInt32LE(runningOffset, 12); // offset of image data
    entryBuffers.push(entry);
    runningOffset += png.length;
  }

  return Buffer.concat([header, ...entryBuffers, ...frames.map((f) => f.png)]);
}

async function main(): Promise<void> {
  const sourceBuffer = fs.readFileSync(ICON_PATH);
  console.log(`Read source icon: ${ICON_PATH} (${sourceBuffer.length} bytes)`);

  const sourcePng = await extractSourcePng(sourceBuffer);

  const frames: Array<{ size: number; png: Buffer }> = [];
  for (const size of TARGET_SIZES) {
    const png = await sharp(sourcePng)
      .resize(size, size, { fit: "cover" })
      .png()
      .toBuffer();
    frames.push({ size, png });
    console.log(`Resampled frame: ${size}x${size} (${png.length} bytes, PNG)`);
  }

  const icoBuffer = assembleIco(frames);
  fs.writeFileSync(ICON_PATH, icoBuffer);

  console.log(
    `\nWrote multi-resolution ICO: ${ICON_PATH}\n` +
      `  Frames: ${frames.map((f) => `${f.size}x${f.size}`).join(", ")}\n` +
      `  Total size: ${icoBuffer.length} bytes`,
  );
}

main().catch((error) => {
  console.error("generate-icon.ts FAILED:\n", error);
  process.exitCode = 1;
});
