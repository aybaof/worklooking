import { useState, useEffect, useCallback, useRef } from 'react';
import { CandidatureConfig } from '@/../shared/candidature-types';
import { useDebounce } from '@/lib/useDebounce';

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
  const [isDirty, setIsDirty] = useState(false);

  const initialLoadDone = useRef(false);
  const debouncedConfig = useDebounce(config, 1500);

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
        initialLoadDone.current = true;
        return;
      } catch (e) {
        console.error("Failed to parse config from localStorage", e);
      }
    }
    setIsLoading(false);
    initialLoadDone.current = true;
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
      setIsDirty(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save config:", err);
      setError("Erreur lors de l'enregistrement en local.");
    } finally {
      setIsSaving(false);
    }
  }, [config]);

  // Auto-save effect
  useEffect(() => {
    if (initialLoadDone.current && isDirty) {
      saveConfig();
    }
  }, [debouncedConfig, saveConfig, isDirty]);

  const updateCandidate = useCallback((field: string, value: string | string[] | undefined) => {
    setIsDirty(true);
    setConfig((prev) => ({
      ...prev,
      candidate: { ...prev.candidate, [field]: value },
    }));
  }, []);

  const updateCandidateSkill = useCallback((index: number, field: string, value: string | string[] | undefined) => {
    setIsDirty(true);
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
    setIsDirty(true);
    setConfig((prev) => ({
      ...prev,
      candidate: {
        ...prev.candidate,
        skills: [...prev.candidate.skills, { category: "", technologies: "" }],
      },
    }));
  }, []);

  const removeCandidateSkill = useCallback((index: number) => {
    setIsDirty(true);
    setConfig((prev) => ({
      ...prev,
      candidate: {
        ...prev.candidate,
        skills: prev.candidate.skills.filter((_, i) => i !== index),
      },
    }));
  }, []);

  const updateGoals = useCallback((field: string, value: string | string[] | undefined) => {
    setIsDirty(true);
    setConfig((prev) => ({
      ...prev,
      goals: { ...prev.goals, [field]: value },
    }));
  }, []);

  const addItem = useCallback((section: "target_companies" | "applications", defaultValue: unknown) => {
    setIsDirty(true);
    setConfig((prev) => ({
      ...prev,
      [section]: [...prev[section], defaultValue as any],
    }));
  }, []);

  const removeItem = useCallback((section: "target_companies" | "applications", index: number) => {
    setIsDirty(true);
    setConfig((prev) => ({
      ...prev,
      [section]: prev[section].filter((_, i) => i !== index),
    }));
  }, []);

  const updateItem = useCallback((section: "target_companies" | "applications", index: number, field: string, value: string | string[] | undefined) => {
    setIsDirty(true);
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
    isDirty,
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
