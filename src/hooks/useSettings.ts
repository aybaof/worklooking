import { useState, useEffect, useCallback } from 'react';
import { Channels } from '@/../shared/ipc';

export function useSettings() {
  const [apiKey, setApiKey] = useState(
    localStorage.getItem("opencode_api_key") || "",
  );
  const [selectedModel, setSelectedModel] = useState(
    localStorage.getItem("opencode_model") || "gemini-3-flash-preview",
  );
  const [userDataPath, setUserDataPath] = useState("");

  useEffect(() => {
    const savedPath = localStorage.getItem("worklooking_data_path");
    if (savedPath) {
      window.api.invoke(Channels.APP_SET_USER_DATA_PATH, savedPath).then((res) => {
        if (res.success) {
          setUserDataPath(savedPath);
          
          // Migration check for candidature_config.json
          const savedConfig = localStorage.getItem("worklooking_candidature_config");
          if (!savedConfig) {
            window.api
              .invoke(Channels.FILE_READ, { filePath: "candidature_config.json" })
              .then((fileRes) => {
                if (fileRes.content) {
                  localStorage.setItem("worklooking_candidature_config", fileRes.content);
                }
              });
          }
        } else {
          window.api.invoke(Channels.APP_GET_USER_DATA_PATH).then(setUserDataPath);
        }
      });
    } else {
      window.api.invoke(Channels.APP_GET_USER_DATA_PATH).then(setUserDataPath);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("opencode_api_key", apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem("opencode_model", selectedModel);
  }, [selectedModel]);

  const handleSelectFolder = useCallback(async () => {
    const path = await window.api.invoke(Channels.DIALOG_SELECT_FOLDER);
    if (path) {
      const res = await window.api.invoke(Channels.APP_SET_USER_DATA_PATH, path);
      if (res.success) {
        setUserDataPath(path);
        localStorage.setItem("worklooking_data_path", path);
      }
    }
  }, []);

  return {
    apiKey,
    setApiKey,
    selectedModel,
    setSelectedModel,
    userDataPath,
    handleSelectFolder,
  };
}
