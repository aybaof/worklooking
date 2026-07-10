/**
 * Tier 3 — renderer hook.
 * See tests/TEST_PLAN.md → "Tier 3: useSettings".
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { installMockWindowApi } from "../../tests/renderer/mockWindowApi";
import { Channels } from "@/../shared/ipc";
import { getPresetById } from "@/../shared/provider-types";
import { useSettings } from "./useSettings";

describe("useSettings", () => {
  let api: ReturnType<typeof installMockWindowApi>;

  beforeEach(() => {
    api = installMockWindowApi();
    // Default: no saved data path → hook just fetches the current one.
    api.invoke.mockResolvedValue("/default/data/path");
  });

  it("handleProviderChange applies preset baseURL and model defaults", async () => {
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.userDataPath).toBe("/default/data/path"));

    act(() => {
      result.current.handleProviderChange("openai");
    });

    const preset = getPresetById("openai");
    expect(result.current.selectedProvider).toBe("openai");
    expect(result.current.baseURL).toBe(preset?.baseURL);
    expect(result.current.selectedModel).toBe(preset?.models[0]);
  });

  it("clears the model when the preset has no models (e.g. ollama)", async () => {
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.userDataPath).toBe("/default/data/path"));

    act(() => {
      result.current.handleProviderChange("ollama");
    });

    expect(result.current.selectedModel).toBe("");
  });

  it("derives api = customApi when provider is 'custom'", async () => {
    localStorage.setItem("worklooking_provider", "custom");
    localStorage.setItem("worklooking_custom_api", "anthropic");

    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.userDataPath).toBe("/default/data/path"));

    expect(result.current.api).toBe("anthropic");
  });

  it("derives api from the preset otherwise", async () => {
    localStorage.setItem("worklooking_provider", "openai");

    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.userDataPath).toBe("/default/data/path"));

    expect(result.current.api).toBe("openai");
  });

  it("persists settings to localStorage", async () => {
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.userDataPath).toBe("/default/data/path"));

    act(() => {
      result.current.setApiKey("secret-key");
      result.current.setSelectedModel("gpt-4o");
    });

    act(() => {
      result.current.handleProviderChange("openai");
    });

    expect(localStorage.getItem("opencode_api_key")).toBe("secret-key");
    expect(localStorage.getItem("worklooking_provider")).toBe("openai");
    expect(localStorage.getItem("worklooking_base_url")).toBe(
      getPresetById("openai")?.baseURL,
    );
    expect(localStorage.getItem("opencode_model")).toBe(
      getPresetById("openai")?.models[0],
    );
  });

  it("migrates legacy candidature_config.json on startup", async () => {
    localStorage.setItem("worklooking_data_path", "/saved/path");

    api.invoke.mockImplementation((channel: string) => {
      if (channel === Channels.APP_SET_USER_DATA_PATH) {
        return Promise.resolve({ success: true });
      }
      if (channel === Channels.FILE_READ) {
        return Promise.resolve({ content: '{"legacy":"config"}' });
      }
      return Promise.resolve("/saved/path");
    });

    renderHook(() => useSettings());

    await waitFor(() => {
      expect(localStorage.getItem("worklooking_candidature_config")).toBe(
        '{"legacy":"config"}',
      );
    });

    expect(api.invoke).toHaveBeenCalledWith(
      Channels.APP_SET_USER_DATA_PATH,
      "/saved/path",
    );
    expect(api.invoke).toHaveBeenCalledWith(Channels.FILE_READ, {
      filePath: "candidature_config.json",
    });
  });

  it("does not migrate when a candidature config already exists", async () => {
    localStorage.setItem("worklooking_data_path", "/saved/path");
    localStorage.setItem("worklooking_candidature_config", '{"existing":true}');

    api.invoke.mockImplementation((channel: string) => {
      if (channel === Channels.APP_SET_USER_DATA_PATH) {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve("/saved/path");
    });

    renderHook(() => useSettings());

    await waitFor(() => {
      expect(api.invoke).toHaveBeenCalledWith(
        Channels.APP_SET_USER_DATA_PATH,
        "/saved/path",
      );
    });

    expect(api.invoke).not.toHaveBeenCalledWith(Channels.FILE_READ, {
      filePath: "candidature_config.json",
    });
    expect(localStorage.getItem("worklooking_candidature_config")).toBe(
      '{"existing":true}',
    );
  });
});
