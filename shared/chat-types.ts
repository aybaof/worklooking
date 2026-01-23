export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  tool_call_id?: string;
}

export interface ChatUpdatePayload {
  content: string;
}

export interface ToolStatusPayload {
  name: string;
  status: "start" | "end";
  args?: Record<string, unknown>;
  result?: unknown;
}
