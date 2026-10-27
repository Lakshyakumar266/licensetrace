import * as path from "node:path";
import * as fs from "node:fs";

/**
 * Normalize file paths to POSIX-style forward slashes for stable,
 * cross-platform evidence identifiers and manifests.
 */
export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

/**
 * Returns a relative path from the target root to the file, using forward slashes.
 */
export function relativeToRoot(rootPath: string, targetFile: string): string {
  const rel = path.relative(path.resolve(rootPath), path.resolve(targetFile));
  return normalizePath(rel);
}

/**
 * Checks whether an output directory is located inside the target repository path.
 */
export function isPathInside(parentPath: string, childPath: string): boolean {
  const rel = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

/**
 * Check if a filename matches standard license or attribution patterns (case-insensitive).
 */
export function isLicenseFilename(filename: string): boolean {
  const basename = path.basename(filename).toLowerCase();
  const licensePatterns = [
    /^licen[sc]e(\.txt|\.md|\.rst)?$/,
    /^copying(\.txt|\.md|\.rst)?$/,
    /^copyright(\.txt|\.md|\.rst)?$/,
    /^notice(\.txt|\.md|\.rst)?$/,
    /^unlicense(\.txt|\.md|\.rst)?$/,
    /^patents(\.txt|\.md|\.rst)?$/,
    /^authors(\.txt|\.md|\.rst)?$/,
    /^contributors(\.txt|\.md|\.rst)?$/,
  ];
  return licensePatterns.some((pattern) => pattern.test(basename));
}

/**
 * Check if a filename is a known package manifest file.
 */
export function isPackageManifestFilename(filename: string): boolean {
  const basename = path.basename(filename).toLowerCase();
  const manifests = [
    "package.json",
    "cargo.toml",
    "pyproject.toml",
    "setup.py",
    "setup.cfg",
    "pom.xml",
    "go.mod",
    "composer.json",
    "gemfile",
    "*.gemspec",
  ];
  return manifests.some((m) => {
    if (m.startsWith("*.")) {
      return basename.endsWith(m.slice(1));
    }
    return basename === m;
  });
}

/**
 * Check if a filename is a README file.
 */
export function isReadmeFilename(filename: string): boolean {
  const basename = path.basename(filename).toLowerCase();
  return /^readme(\.(md|txt|rst|markdown))?$/.test(basename);
}

/**
 * Safe directory check
 */
export function directoryExists(dirPath: string): boolean {
  try {
    const stats = fs.statSync(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Safe file check
 */
export function fileExists(filePath: string): boolean {
  try {
    const stats = fs.statSync(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}
