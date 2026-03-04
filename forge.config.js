const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");
const { VitePlugin } = require("@electron-forge/plugin-vite");
const { Walker, DepType } = require("flora-colossus");
const fsp = require("node:fs/promises");

const path = require("path");

const externalDependencies = [
  "openai",
  "pdf-parse",
  "sharp",
  "handlebars",
  "moment",
  "update-electron-app",
  "electron-squirrel-startup",
  "@img/sharp-win32-x64",
];

module.exports = {
  packagerConfig: {
    name: "WorkLookingAgent",
    executableName: "WorkLookingAgent",
    appId: "com.worklooking.agent",
    appVersion: "1.0.0",
    asar: {
      // The auto-unpack-natives plugin handles .node files.
      // We additionally unpack .dll files needed by native addons (e.g. sharp/libvips).
      unpackDir: "node_modules",
    },
    icon: path.resolve(__dirname, "electron/icon.ico"),
    extraResource: ["electron/themes/", "electron/agent/agent.md"],
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "WorkLookingAgent",
        authors: "Aymeric Barakat",
        exe: "WorkLookingAgent.exe",
        setupIcon: path.resolve(__dirname, "electron/icon.ico"),
        noMsi: true,
        setupExe: "WorkLookingAgent-Setup-${version}.exe",
        skipUpdateIcon: true,
      },
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },
    {
      name: "@electron-forge/maker-deb",
      config: {},
    },
    {
      name: "@electron-forge/maker-rpm",
      config: {},
    },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },

    new VitePlugin({
      // Vite config for building the main process and preload script
      build: [
        {
          // Main process entry point
          entry: "electron/main.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          // Preload script entry point
          entry: "electron/preload.ts",
          config: "vite.main.config.ts",
          target: "preload",
        },
      ],
      // Vite config for the renderer process (React app)
      renderer: [
        {
          name: "main_window",
          config: "vite.config.ts",
        },
      ],
    }),

    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: {
          owner: "aybaof",
          name: "worklooking",
        },
        authToken: process.env.GITHUB_TOKEN,
        prerelease: true,
        draft: false,
      },
    },
  ],
  hooks: {
    async packageAfterCopy(_forgeConfig, buildPath) {
      try {
        const depsToCopy = new Set(externalDependencies);

        const sourceNodeModulesPath = path.resolve(__dirname, "node_modules");
        const destNodeModulesPath = path.resolve(buildPath, "node_modules");

        for (const dep of externalDependencies) {
          const depPath = path.join(sourceNodeModulesPath, dep);
          try {
            await fsp.access(depPath);
            const walker = new Walker(depPath);
            await walker.walkDependenciesForModule(depPath, DepType.PROD);
            walker.modules.forEach((treeDep) => {
              depsToCopy.add(treeDep.name);
            });
          } catch (walkErr) {
            // Walker may fail on scoped/platform-specific packages;
            // the package itself is still in depsToCopy from the initial Set
            console.warn(
              `flora-colossus could not walk "${dep}", copying it directly:`,
              walkErr.message,
            );
          }
        }

        await Promise.all(
          Array.from(depsToCopy.values()).map(async (packageName) => {
            const sourcePath = path.join(sourceNodeModulesPath, packageName);
            const destPath = path.join(destNodeModulesPath, packageName);

            await fsp.mkdir(path.dirname(destPath), { recursive: true });
            await fsp.cp(sourcePath, destPath, {
              recursive: true,
              preserveTimestamps: true,
            });
          }),
        );
      } catch (err) {
        console.error("packageAfterCopy hook failed:", err);
        throw err;
      }
    },
  },
};
