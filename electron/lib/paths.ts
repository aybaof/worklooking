import path from "path";
import { ErrorCodes } from "../../shared/ipc";

/**
 * Error carrying a machine-readable IPC error code alongside its message.
 * Thrown by main-process helpers and surfaced to the renderer via the IPC
 * error contract (`shared/ipc.ts`).
 */
export class IPCError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "IPCError";
  }
}

/**
 * Validate and normalize a filesystem path, guarding against directory
 * traversal outside of `basePath`.
 *
 * - Relative paths are resolved against `basePath`.
 * - Already-absolute paths are accepted as-is (they are trusted callers such
 *   as OS file dialogs).
 * - Relative paths that normalize to outside `basePath` are rejected.
 *
 * @throws {IPCError} with code `INVALID_PATH` on empty input or traversal.
 */
export function validateAndSanitizePath(
  filePath: string,
  basePath: string,
): string {
  if (!filePath) {
    throw new IPCError(ErrorCodes.INVALID_PATH, "Path is required");
  }

  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(basePath, filePath);

  const normalizedPath = path.normalize(resolvedPath);

  // Prevent directory traversal
  if (!normalizedPath.startsWith(basePath) && !path.isAbsolute(filePath)) {
    throw new IPCError(ErrorCodes.INVALID_PATH, "Path traversal not allowed");
  }

  return normalizedPath;
}
