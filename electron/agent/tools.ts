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
              "Chemin relatif où sauvegarder le HTML (ex: candidatures/doctolib/resume.html)",
          },
          pdfPath: {
            type: "string",
            description:
              "Chemin relatif où sauvegarder le PDF (ex: candidatures/doctolib/resume.pdf)",
          },
        },
        required: ["resumeJson", "htmlPath", "pdfPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "render_resume_html",
      description:
        "Génère un APERÇU HTML d'une proposition de CV adapté SANS écrire aucun fichier. À utiliser pour PROPOSER un CV adapté à une offre pendant la conversation : l'aperçu est présenté à l'utilisateur afin qu'il puisse le relire et donner ses retours AVANT la génération finale. Appelle cet outil pour proposer le CV adapté ; n'utilise 'generate_resume_files' (qui écrit les fichiers HTML et PDF) qu'après validation explicite de l'utilisateur. Fournis TOUJOURS 'company' et 'position' d'après le contexte de l'offre d'emploi : ils servent à nommer automatiquement le dossier de candidature au moment de la validation.",
      parameters: {
        type: "object",
        properties: {
          resumeJson: {
            type: "object",
            description: "Le contenu du CV au format JSON Resume.",
          },
          company: {
            type: "string",
            description:
              "Nom de l'entreprise ciblée par cette offre (ex: Doctolib).",
          },
          position: {
            type: "string",
            description:
              "Intitulé du poste ciblé par cette offre (ex: Développeur Fullstack).",
          },
        },
        required: ["resumeJson", "company", "position"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_url",
      description:
        "Récupère le contenu texte d'une URL (offre d'emploi, site entreprise). Utilise une session persistante pour préserver les cookies entre les appels. Si une connexion est nécessaire, une fenêtre de navigateur visible s'ouvre automatiquement pour que l'utilisateur puisse se connecter ; une fois connecté, il clique sur « J'ai terminé, continuer », la fenêtre se ferme et la page d'origine est revérifiée automatiquement pour en récupérer le contenu. Si la connexion n'est toujours pas terminée à ce moment-là, la fonction retourne une erreur invitant l'utilisateur à réessayer une fois bien connecté. Si l'utilisateur ferme cette fenêtre sans cliquer sur « J'ai terminé, continuer », la fonction retourne une erreur.",
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
  {
    type: "function",
    function: {
      name: "analyze_job_offer",
      description:
        "Analyse une offre d'emploi (à partir d'une URL ou d'un texte brut) et retourne un résumé structuré : entreprise, poste, séniorité, exigences clés et mots-clés. Fournir SOIT 'url' SOIT 'text', jamais les deux. Le résultat est structuré uniquement — le texte brut de l'offre n'est jamais renvoyé tel quel.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "URL de l'offre d'emploi à analyser.",
          },
          text: {
            type: "string",
            description: "Texte brut de l'offre d'emploi à analyser.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_motivation_letter",
      description:
        "Rédige une lettre de motivation en français (250 à 400 mots environ) à partir d'un extrait du CV et de l'offre déjà disponibles dans la conversation. N'invente jamais d'expérience, de diplôme ou de compétence absente du CV fourni. Retourne uniquement le texte de la lettre (jamais de fichier) ; pour l'enregistrer sur disque, utiliser ensuite l'outil 'write_file' séparément, à la demande explicite de l'utilisateur.",
      parameters: {
        type: "object",
        properties: {
          resumeExcerpt: {
            type: "object",
            description:
              "Extrait du CV (JSON Resume ou sous-ensemble) déjà disponible dans la conversation.",
          },
          offer: {
            type: ["string", "object"],
            description:
              "Résultat structuré de 'analyze_job_offer', ou texte/résumé brut de l'offre.",
          },
          company: {
            type: "string",
            description: "Nom de l'entreprise ciblée par cette offre.",
          },
          position: {
            type: "string",
            description: "Intitulé du poste ciblé par cette offre.",
          },
        },
        required: ["resumeExcerpt", "offer", "company", "position"],
      },
    },
  },
];
