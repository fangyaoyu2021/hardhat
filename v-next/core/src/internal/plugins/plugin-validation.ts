import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

import { HardhatError } from "@nomicfoundation/hardhat-errors";
import semver from "semver";

import { HardhatPlugin } from "../../types/plugins.js";

/**
 * A simplified version of the package.json object
 */
interface PackageJson {
  version: string;
  peerDependencies: {
    [name: string]: string;
  };
}

/**
 * Validate that a plugin is installed and that its peer dependencies are installed and satisfy the version constraints.
 *
 * @param plugin - the plugin to be validated
 * @param basePathForNpmResolution - the directory path to use for node module resolution, defaulting to `process.cwd()`
 */
export async function validatePluginNpmDependencies(
  plugin: HardhatPlugin,
  // TODO: When all loads where based on a hardhat config file
  // on disk we used the config file's directory as the base path
  // We need to decide if the current working directory is the right
  // option for module resolution now
  basePathForNpmResolution?: string,
): Promise<void> {
  if (plugin.npmPackage === undefined) {
    return;
  }

  const pluginPackageJson = readPackageJson(
    plugin.npmPackage,
    basePathForNpmResolution,
  );

  if (pluginPackageJson === undefined) {
    throw new HardhatError(HardhatError.ERRORS.PLUGINS.PLUGIN_NOT_INSTALLED, {
      pluginId: plugin.id,
    });
  }

  if (pluginPackageJson.peerDependencies === undefined) {
    return;
  }

  for (const [dependencyName, versionSpec] of Object.entries(
    pluginPackageJson.peerDependencies,
  )) {
    const dependencyPackageJson = readPackageJson(
      dependencyName,
      basePathForNpmResolution,
    );

    if (dependencyPackageJson === undefined) {
      throw new HardhatError(
        HardhatError.ERRORS.PLUGINS.PLUGIN_MISSING_DEPENDENCY,
        {
          pluginId: plugin.id,
          peerDependencyName: dependencyName,
        },
      );
    }

    const installedVersion = dependencyPackageJson.version;

    if (!semver.satisfies(installedVersion, versionSpec)) {
      throw new HardhatError(
        HardhatError.ERRORS.PLUGINS.DEPENDENCY_VERSION_MISMATCH,
        {
          pluginId: plugin.id,
          peerDependencyName: dependencyName,
          installedVersion,
          expectedVersion: versionSpec,
        },
      );
    }
  }
}

/**
 * Read the package.json of a named package resolved through the node
 * require system.
 *
 * @param packageName - the package name i.e. "@nomiclabs/hardhat-waffle"
 * @param baseRequirePath - the directory path to use for resolution, defaults to `process.cwd()`
 * @returns the package.json object or undefined if the package is not found
 */
export function readPackageJson(
  packageName: string,
  baseRequirePath?: string,
): PackageJson | undefined {
  try {
    const require = createRequire(baseRequirePath ?? process.cwd());

    const packageJsonPath = require.resolve(
      path.join(packageName, "package.json"),
    );

    return require(packageJsonPath);
  } catch (error) {
    return undefined;
  }
}
