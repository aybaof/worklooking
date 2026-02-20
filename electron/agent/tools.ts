import { OpenAI } from "openai/client";

export const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Lit un fichier local (ex: offre.md, notes.md).",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "Chemin relatif ou absolu.",
          },
        },
        required: ["filePath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_candidature_config",
      description:
        "Sauvegarde la configuration globale de candidature (profil, objectifs, entreprises cibles, suivi). À utiliser pour toute modification du profil ou du suivi des candidatures.",
      parameters: {
        type: "object",
        properties: {
          config: {
            type: "object",
            description:
              "L'objet de configuration complet au format CandidatureConfig.",
          },
        },
        required: ["config"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Crée ou met à jour un fichier dans le dossier utilisateur.",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "Chemin relatif (ex: candidatures/offre.md)",
          },
          content: { type: "string" },
        },
        required: ["filePath", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_resume_files",
      description:
        "Crée les fichiers HTML et PDF du CV à partir du JSON Resume. Génère automatiquement les deux formats et les sauvegarde aux chemins spécifiés. Si la génération du PDF échoue, le HTML est quand même sauvegardé et l'erreur est reportée.",
      parameters: {
        type: "object",
        properties: {
          resumeJson: {
            type: "object",
            description: "Le contenu du CV au format JSON Resume.",
          },
          htmlPath: {
            type: "string",
            description:
              "Chemin relatif où sauvegarder le HTML (ex: candidatures/2026-02-20_doctolib/resume.html)",
          },
          pdfPath: {
            type: "string",
            description:
              "Chemin relatif où sauvegarder le PDF (ex: candidatures/2026-02-20_doctolib/resume.pdf)",
          },
        },
        required: ["resumeJson", "htmlPath", "pdfPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_url",
      description:
        "Récupère le contenu texte d'une URL (offre d'emploi, site entreprise). Utilise une session persistante pour préserver les cookies entre les appels. Si l'URL nécessite une authentification, la fonction retournera needsAuth: true avec un message d'erreur.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "L'URL à consulter",
          },
          waitForSelector: {
            type: "string",
            description:
              "Optionnel: attend qu'un sélecteur CSS spécifique soit présent avant d'extraire le contenu (timeout 30s).",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_source_resume",
      description:
        "Sauvegarde le CV source principal. À utiliser uniquement pour le CV de base, pas pour les versions adaptées aux offres.",
      parameters: {
        type: "object",
        properties: {
          resumeJson: {
            type: "object",
            description: "Le contenu complet du CV au format JSON Resume.",
          },
        },
        required: ["resumeJson"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_pdf",
      description: "Extrait le texte d'un fichier PDF (ex: un CV existant).",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "Chemin absolu vers le fichier PDF.",
          },
        },
        required: ["filePath"],
      },
    },
  },
];
