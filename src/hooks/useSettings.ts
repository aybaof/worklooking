import { useState, useEffect, useCallback } from "react";
import { Channels } from "@/../shared/ipc";
import { PROVIDER_PRESETS, getPresetById } from "@/../shared/provider-types";

const DEFAULT_PROVIDER = "gemini";
const DEFAULT_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/";
const DEFAULT_MODEL = "gemini-2.5-flash";

export function useSettings() {
  const [apiKey, setApiKey] = useState(
    localStorage.getItem("opencode_api_key") || "",
  );
  const [selectedProvider, setSelectedProvider] = useState(
    localStorage.getItem("worklooking_provider") || DEFAULT_PROVIDER,
  );
  const [baseURL, setBaseURL] = useState(
    localStorage.getItem("worklooking_base_url") || DEFAULT_BASE_URL,
  );
  const [selectedModel, setSelectedModel] = useState(
    localStorage.getItem("opencode_model") || DEFAULT_MODEL,
  );
  const [userDataPath, setUserDataPath] = useState("");

  // On startup: restore user data path and run migration
  useEffect(() => {
    const savedPath = localStorage.getItem("worklooking_data_path");
    if (savedPath) {
      window.api
        .invoke(Channels.APP_SET_USER_DATA_PATH, savedPath)
        .then((res) => {
          if (res.success) {
            setUserDataPath(savedPath);

            // Migration check for candidature_config.json
            const savedConfig = localStorage.getItem(
              "worklooking_candidature_config",
            );
            if (!savedConfig) {
              window.api
                .invoke(Channels.FILE_READ, {
                  filePath: "candidature_config.json",
                })
                .then((fileRes) => {
                  if (fileRes.content) {
                    localStorage.setItem(
                      "worklooking_candidature_config",
                      fileRes.content,
                    );
                  }
                });
            }
          } else {
            window.api
              .invoke(Channels.APP_GET_USER_DATA_PATH)
              .then(setUserDataPath);
          }
        });
    } else {
      window.api.invoke(Channels.APP_GET_USER_DATA_PATH).then(setUserDataPath);
    }
  }, []);

  // Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem("opencode_api_key", apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem("opencode_model", selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    localStorage.setItem("worklooking_provider", selectedProvider);
  }, [selectedProvider]);

  useEffect(() => {
    localStorage.setItem("worklooking_base_url", baseURL);
  }, [baseURL]);

  // When provider changes, update baseURL and model to preset defaults
  const handleProviderChange = useCallback((providerId: string) => {
    setSelectedProvider(providerId);
    const preset = getPresetById(providerId);
    if (preset) {
      // Only overwrite baseURL if the preset has one (not custom)
      if (preset.baseURL) {
        setBaseURL(preset.baseURL);
      }
      // Set the first model from the preset, or clear for free-text providers
      if (preset.models.length > 0) {
        setSelectedModel(preset.models[0]);
      } else {
        setSelectedModel("");
      }
    }
  }, []);

  const handleSelectFolder = useCallback(async () => {
    const path = await window.api.invoke(Channels.DIALOG_SELECT_FOLDER);
    if (path) {
      const res = await window.api.invoke(
        Channels.APP_SET_USER_DATA_PATH,
        path,
      );
      if (res.success) {
        setUserDataPath(path);
        localStorage.setItem("worklooking_data_path", path);
      }
    }
  }, []);

  // Derive the current preset for UI convenience
  const currentPreset = getPresetById(selectedProvider);
  const providerPresets = PROVIDER_PRESETS;

  return {
    apiKey,
    setApiKey,
    selectedModel,
    setSelectedModel,
    selectedProvider,
    handleProviderChange,
    baseURL,
    setBaseURL,
    currentPreset,
    providerPresets,
    userDataPath,
    handleSelectFolder,
  };
}
