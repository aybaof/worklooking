import sharp from "sharp";
import * as fs from "fs";

/**
 * Image optimization settings
 */
const IMAGE_MAX_SIZE = 200; // Maximum width/height in pixels
const JPEG_QUALITY = 85; // JPEG compression quality (0-100)

/**
 * Process and optimize an image file
 * - Resizes to fit within IMAGE_MAX_SIZE x IMAGE_MAX_SIZE
 * - Converts to JPEG format with compression
 * - Returns base64 data URL for embedding
 *
 * @param filePath - Path to the source image file
 * @returns Object containing success status, data URL, and size info
 */
export async function processImage(filePath: string): Promise<{
  success: boolean;
  dataUrl?: string;
  originalSize?: number;
  optimizedSize?: number;
  error?: string;
}> {
  try {
    // Read the original file to get its size
    const originalBuffer = fs.readFileSync(filePath);
    const originalSize = originalBuffer.length;

    // Process image with sharp
    const processedBuffer = await sharp(filePath)
      .resize(IMAGE_MAX_SIZE, IMAGE_MAX_SIZE, {
        fit: "inside", // Maintain aspect ratio, fit within bounds
        withoutEnlargement: true, // Don't upscale small images
      })
      .jpeg({
        quality: JPEG_QUALITY,
        mozjpeg: true, // Use mozjpeg for better compression
      })
      .toBuffer();

    const optimizedSize = processedBuffer.length;

    // Convert to base64 data URL
    const base64 = processedBuffer.toString("base64");
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    return {
      success: true,
      dataUrl,
      originalSize,
      optimizedSize,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to process image: ${message}`,
    };
  }
}
