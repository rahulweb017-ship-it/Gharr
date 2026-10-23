// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { resolve } = require("metro-resolver");

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, "../src/shared");

const config = getDefaultConfig(projectRoot);

// The app reuses the web app's platform-free code in ../src/shared.
config.watchFolders = [...(config.watchFolders ?? []), sharedRoot];

// Packages imported from ../src/shared (zod) must come from this app's
// node_modules, not the web app's: Metro only serves files inside watchFolders,
// and one copy of zod keeps instanceof checks honest.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isBarePackage = !moduleName.startsWith(".") && !path.isAbsolute(moduleName) && !moduleName.startsWith("@/");
  if (isBarePackage && context.originModulePath.startsWith(sharedRoot)) {
    context = { ...context, originModulePath: path.join(projectRoot, "package.json") };
  }
  return (defaultResolveRequest ?? resolve)(context, moduleName, platform);
};

module.exports = config;
