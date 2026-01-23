import { useState, useEffect, useCallback, useRef } from 'react';
import { Resume } from '@/../shared/resume-types';
import { useDebounce } from '@/lib/useDebounce';

export function useResume() {
  const [resume, setResume] = useState<Resume>({
    basics: {
      name: "",
      label: "",
      email: "",
      phone: "",
      url: "",
      summary: "",
      location: { city: "", countryCode: "", region: "" },
      profiles: [],
    },
    work: [],
    education: [],
    skills: [],
    languages: [],
    projects: [],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const initialLoadDone = useRef(false);
  const debouncedResume = useDebounce(resume, 1500);

  const loadResume = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const savedResume = localStorage.getItem("worklooking_resume");
      if (savedResume) {
        const parsed = JSON.parse(savedResume) as Resume;
        setResume(parsed);
      }
    } catch (err) {
      console.error("Failed to load resume:", err);
      setError("Erreur lors du chargement du CV.");
    } finally {
      setIsLoading(false);
      initialLoadDone.current = true;
    }
  }, []);

  useEffect(() => {
    loadResume();
  }, [loadResume]);

  const saveResume = useCallback(async () => {
    setError(null);
    setSaveSuccess(false);
    setIsSaving(true);
    try {
      localStorage.setItem("worklooking_resume", JSON.stringify(resume, null, 2));
      setSaveSuccess(true);
      setIsDirty(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save resume:", err);
      setError("Erreur lors de l'enregistrement du CV.");
    } finally {
      setIsSaving(false);
    }
  }, [resume]);

  // Auto-save effect
  useEffect(() => {
    if (initialLoadDone.current && isDirty) {
      saveResume();
    }
  }, [debouncedResume, saveResume, isDirty]);

  const updateBasics = useCallback((field: string, value: string | string[] | undefined) => {
    setIsDirty(true);
    setResume((prev) => ({
      ...prev,
      basics: { ...prev.basics, [field]: value },
    }));
  }, []);

  const updateLocation = useCallback((field: string, value: string | string[] | undefined) => {
    setIsDirty(true);
    setResume((prev) => ({
      ...prev,
      basics: {
        ...prev.basics,
        location: { ...prev.basics?.location, [field]: value },
      },
    }));
  }, []);

  const updateProfile = useCallback((index: number, field: string, value: string | string[] | undefined) => {
    setIsDirty(true);
    setResume((prev) => ({
      ...prev,
      basics: {
        ...prev.basics,
        profiles: prev.basics?.profiles?.map((p, i) =>
          i === index ? { ...p, [field]: value } : p,
        ),
      },
    }));
  }, []);

  const removeProfile = useCallback((index: number) => {
    setIsDirty(true);
    setResume((prev) => ({
      ...prev,
      basics: {
        ...prev.basics,
        profiles: prev.basics?.profiles?.filter((_, i) => i !== index),
      },
    }));
  }, []);

  const addItem = useCallback((section: keyof Resume | "basics_profiles", defaultValue: unknown) => {
    setIsDirty(true);
    if (section === "basics_profiles") {
      setResume((prev) => ({
        ...prev,
        basics: {
          ...prev.basics,
          profiles: [...(prev.basics?.profiles || []), defaultValue as any],
        },
      }));
      return;
    }
    setResume((prev) => ({
      ...prev,
      [section]: [...((prev[section] as any[]) || []), defaultValue],
    }));
  }, []);

  const removeItem = useCallback((section: keyof Resume, index: number) => {
    setIsDirty(true);
    setResume((prev) => ({
      ...prev,
      [section]: (prev[section] as any[]).filter((_, i) => i !== index),
    }));
  }, []);

  const updateItem = useCallback((section: keyof Resume, index: number, field: string, value: string | string[] | undefined) => {
    setIsDirty(true);
    setResume((prev) => ({
      ...prev,
      [section]: (prev[section] as any[]).map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    }));
  }, []);

  return {
    resume,
    isLoading,
    isSaving,
    saveSuccess,
    error,
    isDirty,
    loadResume,
    saveResume,
    updateBasics,
    updateLocation,
    updateProfile,
    removeProfile,
    addItem,
    removeItem,
    updateItem,
  };
}
