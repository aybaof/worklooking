import { OpenAI } from "openai/client";

export const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Lit un fichier (ex: resume.json, candidature_config.json).",
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
      name: "render_resume",
      description: "Génère le HTML d'un CV à partir du JSON et d'un thème.",
      parameters: {
        type: "object",
        properties: {
          resumeJson: {
            type: "object",
            description: "Le contenu du CV au format JSON Resume.",
          },
          themeName: {
            type: "string",
            description: "Le nom du thème (ex: modern-sidebar).",
          },
        },
        required: ["resumeJson", "themeName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_url",
      description: "Récupère le contenu texte d'une URL (offre d'emploi, site entreprise).",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "L'URL à consulter" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_pdf",
      description: "Génère un PDF à partir d'un fichier HTML.",
      parameters: {
        type: "object",
        properties: {
          htmlPath: {
            type: "string",
            description: "Chemin relatif vers le HTML source.",
          },
          pdfPath: {
            type: "string",
            description: "Chemin relatif vers le PDF de sortie.",
          },
        },
        required: ["htmlPath", "pdfPath"],
      },
    },
  },
];