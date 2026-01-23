import { useOnboarding } from "@/hooks/useOnboarding";
import { InlineTip } from "@/components/onboarding/InlineTip";

interface GuidanceManagerProps {
  pageId: string;
  children: React.ReactNode;
}

export function GuidanceManager({ pageId, children }: GuidanceManagerProps) {
  const { shouldShowTip, dismissTip } = useOnboarding();

  const getTipForPage = (pageId: string) => {
    switch (pageId) {
      case "settings":
        return {
          tipId: "settings-tip",
          title: "Configurer votre clé API",
          content:
            "Configurez votre clé API OpenCode ici pour activer les fonctionnalités IA dans toute l'application et changer le répertoire de destination pour les documents générés.",
        };
      case "resume-editor":
        return {
          tipId: "resume-tip",
          title: "Construisez votre CV",
          content:
            "Ces sections vous aident à créer un CV complet. Remplissez vos expériences professionnelles, votre formation et vos compétences. Remplissez manuellement ou laissez-vous guider par la conversation avec l'agent",
        };
      case "candidature-editor":
        return {
          tipId: "candidature-tip",
          title: "Définissez votre recherche d'emploi",
          content:
            "Configurez vos critères de recherche d'emploi et les entreprises cibles pour aider l'assistant IA à adapter ses recommandations. Remplissez manuellement ou laissez-vous guider par la conversation avec l'agent",
        };
      case "chat":
        return {
          tipId: "chat-tip",
          title: "Assistant IA",
          content:
            "L'assistant IA peut analyser des offres d'emploi, adapter votre CV pour des postes spécifiques, générer des fichiers PDF et vous guider dans votre recherche d'emploi. Il utilise votre CV source et vos critères de recherche pour créer des candidatures personnalisées.",
        };
      default:
        return null;
    }
  };

  const tip = getTipForPage(pageId);

  return (
    <div className="relative">
      {tip && shouldShowTip(tip.tipId) && (
        <InlineTip
          tipId={tip.tipId}
          title={tip.title}
          content={tip.content}
          onDismiss={dismissTip}
        />
      )}
      {children}
    </div>
  );
}
