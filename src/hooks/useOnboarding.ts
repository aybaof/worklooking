import { useState, useEffect } from "react";

export function useOnboarding() {
  const [dismissedTips, setDismissedTips] = useState<Set<string>>(new Set());

  // Check localStorage for onboarding completion flag
  useEffect(() => {
    const savedDismissedTips = localStorage.getItem("worklooking_dismissed_tips");
    if (savedDismissedTips) {
      setDismissedTips(new Set(JSON.parse(savedDismissedTips)));
    }
  }, []);


  // Dismiss a specific tip
  const dismissTip = (tipId: string) => {
    const newDismissedTips = new Set(dismissedTips);
    newDismissedTips.add(tipId);
    setDismissedTips(newDismissedTips);
    localStorage.setItem("worklooking_dismissed_tips", JSON.stringify(Array.from(newDismissedTips)));
  };

  // Check if a tip should be shown
  const shouldShowTip = (tipId: string): boolean => {
    return !dismissedTips.has(tipId);
  };

  return {
    dismissedTips,
    dismissTip,
    shouldShowTip,
  };
}