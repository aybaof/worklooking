/**
 * Tier: node/shared — IPC contract guard. The CV feedback loop is a
 * single-window in-app modal that reuses ONLY the existing channels
 * (`ai:chat`, `resume:render-preview`, `chat:update`, `tool:status`). The
 * earlier abandoned second-`BrowserWindow` design introduced `feedback:*`
 * channels, a `feedback:validated` event and a `FEEDBACK_NO_SESSION` error
 * code; their ABSENCE is now a deliberate constraint (AC-3).
 */
import { describe, it, expect } from "vitest";
import { Channels, ErrorCodes } from "./ipc";

describe("IPC contract — no feedback:* surface (AC-3)", () => {
  const channelNames = Object.values(Channels) as string[];
  const channelKeys = Object.keys(Channels);

  it("exposes no channel whose name starts with 'feedback:'", () => {
    const feedbackChannels = channelNames.filter((name) =>
      name.startsWith("feedback:"),
    );
    expect(feedbackChannels).toEqual([]);
  });

  it("has no FEEDBACK_* channel constants", () => {
    const feedbackKeys = channelKeys.filter((key) =>
      key.startsWith("FEEDBACK"),
    );
    expect(feedbackKeys).toEqual([]);
  });

  it("does not define a feedback:validated event", () => {
    expect(channelNames).not.toContain("feedback:validated");
  });

  it("reuses only the shared channels the modal needs", () => {
    expect(channelNames).toContain("ai:chat");
    expect(channelNames).toContain("resume:render-preview");
    expect(channelNames).toContain("chat:update");
    expect(channelNames).toContain("tool:status");
  });

  it("has no FEEDBACK_NO_SESSION (or other feedback) error code", () => {
    const feedbackErrorCodes = Object.keys(ErrorCodes).filter((key) =>
      key.toUpperCase().includes("FEEDBACK"),
    );
    expect(feedbackErrorCodes).toEqual([]);
  });
});
