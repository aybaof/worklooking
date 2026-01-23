const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");
const path = require("path");

module.exports = {
  packagerConfig: {
    name: "WorkLookingAgent",
    executableName: "WorkLookingAgent",
    appId: "com.worklooking.agent",
    appVersion: "1.0.0",
    asar: true,
    icon: path.resolve(__dirname, "electron/icon.ico"),
    extraResource: ["electron/themes/", "electron/agent/agent.md"],
    // Only ignore development files, keep all production dependencies
    ignore: [
      /^\/\.git($|\/)/,
      /^\/src($|\/)/,
      /\.ts$/,
      /\.tsx$/,
      /\.js\.map$/,
      /\.test\.js$/,
      /\.spec\.js$/,
    ],
    // Ensure critical modules are not packed in ASAR for better performance
    asarUnpack: [
      "**/node_modules/**/*.{node,dll}",
      "**/node_modules/@openai/**",
      "**/node_modules/pdf-parse/**",
    ],
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
        prerelease: true,
      },
    },
  ],
  hooks: {
    generateAssets: async (forgeConfig, platform, arch) => {
      console.log("🛠️  Generating assets for", platform, arch);
      // You can add custom asset generation here
    },
    prePackage: async (forgeConfig) => {
      console.log("📦 Preparing package...");
      // Ensure build is up to date
      const { execSync } = require("child_process");
      execSync("npm run build", { stdio: "inherit" });
    },
  },
};
