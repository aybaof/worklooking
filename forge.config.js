const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");
const { VitePlugin } = require("@electron-forge/plugin-vite");
const { Walker, DepType } = require("flora-colossus");
const fsp = require("node:fs/promises");

const path = require("path");

const packageJson = require("./package.json");

const externalDependencies = [
  "openai",
  "@anthropic-ai/sdk",
  "pdf-parse",
  "sharp",
  "handlebars",
  "moment",
  "update-electron-app",
  "electron-squirrel-startup",
];

module.exports = {
  packagerConfig: {
    name: "WorkLookingAgent",
    executableName: "WorkLookingAgent",
    appId: "com.worklooking.agent",
    appVersion: packageJson.version,
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
      // deb/rpm derive the expected binary name from the package name unless
      // told otherwise; keep it in sync with packagerConfig.executableName.
      config: {
        options: {
          bin: "WorkLookingAgent",
          license: "MIT",
        },
      },
    },
    {
      name: "@electron-forge/maker-rpm",
      // rpmbuild requires a License field; supply it explicitly since
      // package.json has none.
      config: {
        options: {
          bin: "WorkLookingAgent",
          license: "MIT",
        },
      },
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
        // Re-running the release workflow for the same tag (e.g. to ship a
        // hotfix without bumping the version) must overwrite stale assets —
        // otherwise publisher-github silently skips any file whose name
        // already exists on the release, keeping the old broken build.
        force: true,
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

        // sharp's platform binaries (@img/sharp-<os>-<arch> and
        // @img/sharp-libvips-<os>-<arch>) are optionalDependencies that
        // flora-colossus does not walk. Copy whichever ones are actually
        // installed for the current platform instead of hardcoding one.
        const imgScopePath = path.join(sourceNodeModulesPath, "@img");
        try {
          const imgPackages = await fsp.readdir(imgScopePath);
          for (const pkg of imgPackages) {
            depsToCopy.add(`@img/${pkg}`);
          }
        } catch {
          // No @img scope installed — nothing extra to copy.
        }

        await Promise.all(
          Array.from(depsToCopy.values()).map(async (packageName) => {
            const sourcePath = path.join(sourceNodeModulesPath, packageName);
            const destPath = path.join(destNodeModulesPath, packageName);

            try {
              await fsp.access(sourcePath);
            } catch {
              console.warn(
                `skipping "${packageName}": not present in node_modules on this platform`,
              );
              return;
            }

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
