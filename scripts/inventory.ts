import * as fs from "node:fs";
import * as path from "node:path";
import {
  isLicenseFilename,
  isPackageManifestFilename,
  isReadmeFilename,
  normalizePath,
  relativeToRoot,
} from "./util/paths.js";
import { isBinaryFile } from "./extract.js";

export interface InventoryOptions {
  maxDepth?: number;
  maxFileSizeBytes?: number;
  maxSourceFilesToScan?: number;
  ignoredDirNames?: string[];
}

export interface DiscoveredFile {
  absolutePath: string;
  relativePath: string;
  sizeBytes: number;
  isBinary: boolean;
  isOversized: boolean;
}

export interface RepositoryInventory {
  targetRoot: string;
  licenseFiles: DiscoveredFile[];
  packageManifests: DiscoveredFile[];
  readmeFiles: DiscoveredFile[];
  spdxReuseFiles: DiscoveredFile[];
  sourceFilesWithHeaders: DiscoveredFile[];
  oversizedFiles: DiscoveredFile[];
  totalFilesScanned: number;
}

const DEFAULT_IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "target",
  "vendor",
  ".venv",
  "venv",
  "__pycache__",
  "coverage",
  ".next",
  ".turbo",
  ".licensetrace",
]);

const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".rs",
  ".go",
  ".java",
  ".c",
  ".cpp",
  ".cc",
  ".h",
  ".hpp",
  ".cs",
  ".rb",
  ".php",
  ".swift",
  ".kt",
  ".scala",
  ".sh",
]);

/**
 * Scan target repository and inventory license-relevant files and candidate source files.
 */
export function inventoryRepository(
  targetRoot: string,
  options: InventoryOptions = {}
): RepositoryInventory {
  const root = path.resolve(targetRoot);
  const maxDepth = options.maxDepth ?? 8;
  const maxFileSizeBytes = options.maxFileSizeBytes ?? 1024 * 1024; // 1MB default
  const maxSourceFiles = options.maxSourceFilesToScan ?? 150;
  const ignoredDirs = new Set(options.ignoredDirNames ?? DEFAULT_IGNORED_DIRS);

  const inventory: RepositoryInventory = {
    targetRoot: root,
    licenseFiles: [],
    packageManifests: [],
    readmeFiles: [],
    spdxReuseFiles: [],
    sourceFilesWithHeaders: [],
    oversizedFiles: [],
    totalFilesScanned: 0,
  };

  let sourceFileCount = 0;

  function walk(currentDir: string, currentDepth: number) {
    if (currentDepth > maxDepth) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const entryName = entry.name;
      const fullPath = path.join(currentDir, entryName);

      if (entry.isDirectory()) {
        if (ignoredDirs.has(entryName.toLowerCase())) {
          continue;
        }
        walk(fullPath, currentDepth + 1);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      inventory.totalFilesScanned++;

      let stats: fs.Stats;
      try {
        stats = fs.statSync(fullPath);
      } catch {
        continue;
      }

      const sizeBytes = stats.size;
      const isOversized = sizeBytes > maxFileSizeBytes;
      const relPath = relativeToRoot(root, fullPath);

      const fileInfo: DiscoveredFile = {
        absolutePath: fullPath,
        relativePath: relPath,
        sizeBytes,
        isBinary: isOversized ? false : isBinaryFile(fullPath),
        isOversized,
      };

      if (isOversized) {
        inventory.oversizedFiles.push(fileInfo);
      }

      // 1. License-like files
      if (isLicenseFilename(entryName)) {
        inventory.licenseFiles.push(fileInfo);
      }
      // 2. Package manifests
      else if (isPackageManifestFilename(entryName)) {
        inventory.packageManifests.push(fileInfo);
      }
      // 3. Readme files
      else if (isReadmeFilename(entryName)) {
        inventory.readmeFiles.push(fileInfo);
      }
      // 4. SPDX / REUSE / LICENSES directory files
      else if (
        relPath.startsWith("LICENSES/") ||
        relPath.startsWith(".reuse/") ||
        entryName.toLowerCase() === "spdx.json"
      ) {
        inventory.spdxReuseFiles.push(fileInfo);
      }
      // 5. Source files (candidate for license headers)
      else if (
        !fileInfo.isBinary &&
        !isOversized &&
        SOURCE_EXTENSIONS.has(path.extname(entryName).toLowerCase())
      ) {
        if (sourceFileCount < maxSourceFiles) {
          inventory.sourceFilesWithHeaders.push(fileInfo);
          sourceFileCount++;
        }
      }
    }
  }

  walk(root, 0);

  return inventory;
}
