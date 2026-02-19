// Channel definitions
export const Channels = {
  // File operations
  FILE_READ: "file:read",
  FILE_WRITE: "file:write",

  // Dialog operations
  DIALOG_SELECT_FOLDER: "dialog:select-folder",
  DIALOG_SELECT_FILE: "dialog:select-file",

  // Image operations
  IMAGE_SELECT_AND_OPTIMIZE: "image:select-and-optimize",

  // App operations
  APP_GET_USER_DATA_PATH: "app:get-user-data-path",
  APP_SET_USER_DATA_PATH: "app:set-user-data-path",

  // AI operations
  AI_CHAT: "ai:chat",

  // Events (main -> renderer)
  CHAT_UPDATE: "chat:update",
  TOOL_STATUS: "tool:status",
} as const;

// Type-safe request/response mapping
export interface IPCHandlers {
  "file:read": {
    request: { filePath: string };
    response: { content?: string; error?: string };
  };
  "file:write": {
    request: { filePath: string; content: string };
    response: { success: boolean; path?: string; error?: string };
  };
  "dialog:select-folder": {
    request: void;
    response: string | null;
  };
  "dialog:select-file": {
    request: { filters?: Array<{ name: string; extensions: string[] }> };
    response: string | null;
  };
  "image:select-and-optimize": {
    request: void;
    response: {
      success: boolean;
      dataUrl?: string;
      originalSize?: number;
      optimizedSize?: number;
      error?: string;
    };
  };
  "app:get-user-data-path": {
    request: void;
    response: string;
  };
  "app:set-user-data-path": {
    request: string;
    response: { success: boolean; error?: string };
  };
  "ai:chat": {
    request: {
      messages: Array<{ role: string; content: string | null }>;
      apiKey: string;
      model: string;
      resumeJson?: string;
      configJson?: string;
    };
    response: {
      content?: string;
      error?: string;
      updatedResume?: unknown;
      updatedConfig?: unknown;
    };
  };
}

// Error contract
export interface IPCError {
  code: string;
  message: string;
}

// Error codes
export const ErrorCodes = {
  INVALID_PATH: "INVALID_PATH",
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  WRITE_FAILED: "WRITE_FAILED",
  AI_ERROR: "AI_ERROR",
} as const;
