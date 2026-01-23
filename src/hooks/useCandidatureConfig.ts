import { useState, useEffect, useCallback } from 'react';
import { CandidatureConfig } from '@/../shared/candidature-types';
import { Channels } from '@/../shared/ipc';

export function useCandidatureConfig() {
  const [config, setConfig] = useState<CandidatureConfig>({
    candidate: {
      name: "",
      position: "",
      location: "",
      experience: "",
      languages: [],
      skills: [],
      strengths: [],
    },
    goals: {
      salary_target: "",
      contract_type: "",
      remote_policy: "",
      criteria: [],
    },
    target_companies: [],
    applications: [],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSaveSuccess(false);

    const savedConfig = localStorage.getItem("worklooking_candidature_config");
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig) as CandidatureConfig;
        setConfig(parsed);
        setIsLoading(false);
        return;
      } catch (e) {
        console.error("Failed to parse config from localStorage", e);
      }
    }

    try {
      const response = await window.api.invoke(Channels.FILE_READ, {
        filePath: "candidature_config.json",
      });
      if (response.content) {
        const parsed = JSON.parse(response.content) as CandidatureConfig;
        setConfig(parsed);
        localStorage.setItem("worklooking_candidature_config", response.content);
      }
    } catch (err) {
      console.error("Failed to load config:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const saveConfig = useCallback(async () => {
    setError(null);
    setSaveSuccess(false);
    setIsSaving(true);
    try {
      localStorage.setItem("worklooking_candidature_config", JSON.stringify(config, null, 2));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save config:", err);
      setError("Erreur lors de l'enregistrement en local.");
    } finally {
      setIsSaving(false);
    }
  }, [config]);

  const updateCandidate = useCallback((field: string, value: string | string[] | undefined) => {
    setConfig((prev) => ({
      ...prev,
      candidate: { ...prev.candidate, [field]: value },
    }));
  }, []);

  const updateCandidateSkill = useCallback((index: number, field: string, value: string | string[] | undefined) => {
    setConfig((prev) => ({
      ...prev,
      candidate: {
        ...prev.candidate,
        skills: prev.candidate.skills.map((s, i) =>
          i === index ? { ...s, [field]: value } : s,
        ),
      },
    }));
  }, []);

  const addCandidateSkill = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      candidate: {
        ...prev.candidate,
        skills: [...prev.candidate.skills, { category: "", technologies: "" }],
      },
    }));
  }, []);

  const removeCandidateSkill = useCallback((index: number) => {
    setConfig((prev) => ({
      ...prev,
      candidate: {
        ...prev.candidate,
        skills: prev.candidate.skills.filter((_, i) => i !== index),
      },
    }));
  }, []);

  const updateGoals = useCallback((field: string, value: string | string[] | undefined) => {
    setConfig((prev) => ({
      ...prev,
      goals: { ...prev.goals, [field]: value },
    }));
  }, []);

  const addItem = useCallback((section: "target_companies" | "applications", defaultValue: unknown) => {
    setConfig((prev) => ({
      ...prev,
      [section]: [...prev[section], defaultValue as any],
    }));
  }, []);

  const removeItem = useCallback((section: "target_companies" | "applications", index: number) => {
    setConfig((prev) => ({
      ...prev,
      [section]: prev[section].filter((_, i) => i !== index),
    }));
  }, []);

  const updateItem = useCallback((section: "target_companies" | "applications", index: number, field: string, value: string | string[] | undefined) => {
    setConfig((prev) => ({
      ...prev,
      [section]: (prev[section] as any[]).map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    }));
  }, []);

  return {
    config,
    setConfig,
    isLoading,
    isSaving,
    saveSuccess,
    error,
    loadConfig,
    saveConfig,
    updateCandidate,
    updateCandidateSkill,
    addCandidateSkill,
    removeCandidateSkill,
    updateGoals,
    addItem,
    removeItem,
    updateItem,
  };
}
