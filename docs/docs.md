---
WorkLooking Agent - Project Architecture Summary
1. Project Structure Overview
worklooking/
├── electron/                    # Main process (Electron backend)
│   ├── main.ts                  # Main process entry point with validation
│   ├── preload.ts               # Secure contextBridge API exposure
│   ├── tsconfig.json            # Electron-specific TS config
│   ├── markdown.d.ts            # Type declaration for .md imports
│   ├── icon.ico                 # App icon
│   ├── agent/                   # AI Agent configuration
│   │   ├── tools.ts             # OpenAI function tool definitions
│   │   ├── prompt.ts            # System prompt generation
│   │   └── agent.md             # Agent instructions/configuration
│   └── themes/                  # Resume themes (Handlebars templates)
│       ├── shared/render.ts     # Shared Handlebars rendering
│       ├── modern-sidebar/      # Theme with style.css + resume.hbs
│       └── spartan-fr/          # Theme with style.css + resume.hbs
├── shared/                      # Shared types and contracts
│   ├── ipc.ts                   # IPC channel constants and handlers
│   ├── resume-types.ts          # JSON Resume schema types
│   ├── candidature-types.ts     # Candidature configuration interfaces
│   └── chat-types.ts            # Chat message and tool payload types
├── src/                         # Renderer process (React frontend)
│   ├── main.tsx                 # React entry point
│   ├── App.tsx                  # Root component with routing
│   ├── electron.d.ts            # Global window.api type definitions
│   ├── vite-env.d.ts            # Vite environment types
│   ├── components/
│   │   ├── ErrorBoundary.tsx    # React error boundary component
│   │   ├── ErrorFallback.tsx    # Error UI with retry logic
│   │   ├── ui/                  # Shadcn/ui components
│   │   ├── resume-editor/       # Resume editor section components
│   │   └── candidature-editor/  # Candidature editor section components
│   ├── pages/
│   │   ├── chat.tsx             # AI Chat interface
│   │   ├── configuration.tsx    # Settings page
│   │   ├── resume-editor.tsx    # Resume editor page
│   │   └── candidature-editor.tsx # Candidature config page
│   ├── lib/
│   │   ├── utils.ts             # cn() utility
│   ├── hooks/                   # Business logic extracted from components
│   │   ├── useChat.ts           # Chat messages and AI stream management
│   │   ├── useSettings.ts       # API keys and app settings management
│   │   ├── useResume.ts         # Resume CRUD and state management
│   │   └── useCandidatureConfig.ts # Candidature config management
│   └── styles/
│       └── globals.css          # Tailwind CSS v4
├── index.html                   # HTML entry point for Vite
├── package.json
├── tsconfig.json                # Main TS config for renderer
├── tsconfig.node.json           # TS config for Vite config files
├── vite.config.ts               # Vite config for renderer
├── vite.main.config.ts          # Vite config for main/preload process
├── forge.config.js              # Electron Forge packaging config
└── nodemon.json                 # Hot reload for Electron
---
2. Build Configuration
Build Tools
- Vite for both renderer and main process bundling
- Electron Forge for packaging and distribution
Renderer Process (vite.config.ts)
- Uses @vitejs/plugin-react and @tailwindcss/vite
- Path alias: @/* -> ./src/*
- Outputs to dist/
Main Process (vite.main.config.ts)
- Builds electron/main.ts and electron/preload.ts to CommonJS format
- Outputs to dist-electron/main.js and dist-electron/preload.js
- Includes markdown loader plugin for .md files
- Externalizes electron and node builtins
- SSR: true used for main process bundling
Electron Forge (forge.config.js)
- Makers: Squirrel (Windows), ZIP (macOS), DEB, RPM (Linux)
- ASAR packaging enabled
- Extra resources: electron/themes/, electron/agent/agent.md
- Fuses configured for security (RunAsNode disabled, cookie encryption enabled)
- Pre-package hook runs npm run build
NPM Scripts
- dev: Runs Vite dev server, watches main/preload, and starts Electron with nodemon
- build: Builds both renderer (dist/) and main process (dist-electron/)
- make: Full production build + Windows package
---
3. IPC Communication Patterns
Architecture
- Secure contextBridge: Uses contextIsolation: true and sandbox: true
- Typed API: Renderer accesses main process via window.api (defined in preload.ts)
- Centralized Channels: All channel names defined in shared/ipc.ts
- Input Validation: Main process validates all paths and inputs to prevent traversal
IPC Channels (window.api.invoke)
| Channel                | Direction        | Purpose                         |
| ---------------------- | ---------------- | ------------------------------- |
| app:get-user-data-path | Main -> Renderer | Get current user data directory |
| app:set-user-data-path | Renderer -> Main | Change user data directory      |
| dialog:select-folder   | Renderer -> Main | Native folder picker dialog     |
| dialog:select-file     | Renderer -> Main | Native file picker dialog       |
| file:read              | Renderer -> Main | Read file from user data dir    |
| file:write             | Renderer -> Main | Write file to user data dir     |
| ai:chat                | Renderer -> Main | Send message to AI agent        |
IPC Events (window.api.on)
| Event       | Direction        | Purpose                         |
| ----------- | ---------------- | ------------------------------- |
| chat:update | Main -> Renderer | Stream partial AI responses     |
| tool:status | Main -> Renderer | Notify tool execution start/end |
AI Agent Tool Loop
The main process implements an OpenAI function-calling loop:
1. Receives messages from renderer via ai:chat
2. Calls OpenAI with tools defined in tools.ts
3. Executes tool calls locally via executeTool() helper
4. Sends streaming updates via chat:update and tool:status events
5. Returns final response with optional updatedResume and updatedConfig
---
4. State Management
Approach: Custom Hooks + Local State + localStorage
No centralized state management library. Logic is encapsulated in hooks.
Key Hooks
- useChat: Manages message history, typing state, and AI interaction
- useSettings: Manages API key, selected model, and storage path
- useResume: Manages loading, saving, and updating resume JSON
- useCandidatureConfig: Manages job application criteria and history
State Locations
| Data               | Storage                                       | Access (via Hooks)     |
| ------------------ | --------------------------------------------- | ---------------------- |
| API Key            | localStorage (opencode_api_key)               | useSettings            |
| Model              | localStorage (opencode_model)                 | useSettings            |
| User Data Path     | localStorage (worklooking_data_path)          | useSettings            |
| Resume JSON        | localStorage (worklooking_resume)             | useResume              |
| Candidature Config | localStorage (worklooking_candidature_config) | useCandidatureConfig   |
| Chat Messages      | React useState (useChat)                      | ChatPage               |
Data Flow Pattern
1. Hooks encapsulate state and side effects (IPC calls, localStorage)
2. Pages consume hooks and pass data/callbacks to UI components
3. Components are "dumb" rendering layers with minimal logic
---
5. TypeScript Configuration
Main tsconfig.json (Renderer)
{
  target: ES2020,
  module: ESNext,
  moduleResolution: bundler,
  jsx: react-jsx,
  strict: true,
  paths: { @/*: [./src/*] }
}
electron/tsconfig.json (Main Process)
{
  target: ESNext,
  module: CommonJS,
  moduleResolution: node,
  esModuleInterop: true,
  outDir: ../dist-electron
}
Key Type Files
- shared/ipc.ts: IPC contracts and channel naming
- shared/resume-types.ts: JSON Resume schema types
- shared/candidature-types.ts: CandidatureConfig interface
- shared/chat-types.ts: Message and stream payload interfaces
---
6. Conventions & Patterns
File Organization
- Pages: src/pages/ (Thin rendering layers)
- Hooks: src/hooks/ (Business logic and state)
- Shared: shared/ (Code shared between Electron and React)
- UI Components: src/components/ui/ (Atomic components)
Security Patterns
1. Early returns: Used in main process and hooks for clarity
2. Path Sanitization: All file operations validated against base path
3. Typed Errors: IPCError used for consistent error reporting
Naming Conventions
- Components: PascalCase
- Hooks: camelCase with 'use' prefix
- Types: PascalCase (Interface) or SCREAMING_SNAKE_CASE (Constants)
- IPC Channels: domain:action (e.g., file:read)
---
7. Key Dependencies
- electron: ^40.0.0
- react: ^19.2.3
- openai: ^6.16.0
- handlebars: ^4.7.8
- pdf-parse: ^2.4.5
- lucide-react: Icons
- tailwindcss: ^4.1.18 Styling
---
8. Notable Architecture Decisions
1. Secure Context Bridge: Enabled contextIsolation and sandbox for security.
2. Logic/UI Separation: All business logic resides in Hooks, not Components.
3. Centralized IPC: Channels are constants, ensuring no typos across processes.
4. Input Validation: Main process treats renderer as untrusted.
5. Error Boundaries: Application-wide graceful failure handling.
---
Files Summary
| Category       | Key Files                                               |
| -------------- | ------------------------------------------------------- |
| Main Process   | electron/main.ts, electron/preload.ts                   |
| Shared         | shared/ipc.ts, shared/*-types.ts                        |
| Business Logic | src/hooks/use*.ts                                       |
| Pages          | src/pages/*.tsx                                         |
| Error Handling | src/components/ErrorBoundary.tsx                        |
| Build Config   | vite.config.ts, vite.main.config.ts                     |
