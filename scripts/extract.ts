import * as fs from "node:fs";
import * as path from "node:path";
import { hashFile, type HashResult } from "./util/hash.js";

export interface BoundedExcerpt {
  text: string;
  startLine: number;
  endLine: number;
  truncated: boolean;
  totalLines: number;
}

export interface HeaderExtraction {
  hasHeader: boolean;
  spdxId?: string;
  copyrightNotice?: string;
  licenseMention?: string;
  excerpt: BoundedExcerpt;
}

export interface PackageMetadataExtraction {
  format: "npm" | "cargo" | "python" | "maven" | "go" | "unknown";
  declaredLicense?: string;
  authors?: string[];
  repositoryUrl?: string;
  rawExcerpt: BoundedExcerpt;
}

export interface ReadmeExtraction {
  hasLicenseSection: boolean;
  sectionHeading?: string;
  excerpt: BoundedExcerpt;
}

/**
 * Check if a file appears to be binary by scanning the first 8000 bytes for null bytes.
 */
export function isBinaryFile(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(8000);
    const bytesRead = fs.readSync(fd, buffer, 0, 8000, 0);
    fs.closeSync(fd);

    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Read a bounded excerpt from a text file, capturing line range and total lines.
 */
export function readBoundedExcerpt(
  filePath: string,
  startLine: number = 1,
  maxLines: number = 50,
  maxChars: number = 2000
): BoundedExcerpt {
  const content = fs.readFileSync(filePath, "utf-8");
  const allLines = content.split(/\r?\n/);
  const totalLines = allLines.length;

  const startIndex = Math.max(0, startLine - 1);
  const selectedLines = allLines.slice(startIndex, startIndex + maxLines);

  let text = selectedLines.join("\n");
  let truncated = false;

  if (text.length > maxChars) {
    text = text.slice(0, maxChars) + "\n... [truncated]";
    truncated = true;
  }

  const endLine = Math.min(totalLines, startIndex + selectedLines.length);

  return {
    text,
    startLine: startIndex + 1,
    endLine,
    truncated: truncated || endLine < totalLines,
    totalLines,
  };
}

/**
 * Extract license or copyright headers from a source code file (first 100 lines).
 */
export function extractSourceHeader(filePath: string): HeaderExtraction | null {
  if (isBinaryFile(filePath)) {
    return null;
  }

  const excerpt = readBoundedExcerpt(filePath, 1, 100, 2500);
  const text = excerpt.text;

  const spdxMatch = text.match(/SPDX-License-Identifier:\s*([^\r\n*\/#]+)/i);
  const copyrightMatch = text.match(/(?:copyright|©|\(c\))\s+([^\r\n*\/#]+)/i);
  const licenseMatch = text.match(/licensed under\s+([^\r\n*\/#]+)/i);

  const hasHeader = Boolean(spdxMatch || copyrightMatch || licenseMatch);
  if (!hasHeader) {
    return null;
  }

  return {
    hasHeader: true,
    spdxId: spdxMatch ? spdxMatch[1].trim() : undefined,
    copyrightNotice: copyrightMatch ? copyrightMatch[0].trim() : undefined,
    licenseMention: licenseMatch ? licenseMatch[0].trim() : undefined,
    excerpt,
  };
}

/**
 * Extract package licensing metadata from manifest files.
 */
export function extractPackageMetadata(filePath: string): PackageMetadataExtraction | null {
  if (isBinaryFile(filePath)) {
    return null;
  }

  const filename = path.basename(filePath).toLowerCase();
  const excerpt = readBoundedExcerpt(filePath, 1, 60, 2000);

  if (filename === "package.json") {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const pkg = JSON.parse(raw);
      let declaredLicense: string | undefined;

      if (typeof pkg.license === "string") {
        declaredLicense = pkg.license;
      } else if (typeof pkg.license === "object" && pkg.license?.type) {
        declaredLicense = pkg.license.type;
      } else if (Array.isArray(pkg.licenses)) {
        declaredLicense = pkg.licenses.map((l: any) => l.type || l).join(" OR ");
      }

      const authors: string[] = [];
      if (typeof pkg.author === "string") authors.push(pkg.author);
      else if (pkg.author?.name) authors.push(pkg.author.name);
      if (Array.isArray(pkg.contributors)) {
        for (const c of pkg.contributors) {
          if (typeof c === "string") authors.push(c);
          else if (c?.name) authors.push(c.name);
        }
      }

      let repoUrl: string | undefined;
      if (typeof pkg.repository === "string") repoUrl = pkg.repository;
      else if (pkg.repository?.url) repoUrl = pkg.repository.url;

      return {
        format: "npm",
        declaredLicense,
        authors: authors.length > 0 ? authors : undefined,
        repositoryUrl: repoUrl,
        rawExcerpt: excerpt,
      };
    } catch {
      return { format: "npm", rawExcerpt: excerpt };
    }
  }

  if (filename === "cargo.toml") {
    const raw = fs.readFileSync(filePath, "utf-8");
    const licMatch = raw.match(/license\s*=\s*["']([^"']+)["']/i);
    const licFileMatch = raw.match(/license-file\s*=\s*["']([^"']+)["']/i);
    const repoMatch = raw.match(/repository\s*=\s*["']([^"']+)["']/i);

    return {
      format: "cargo",
      declaredLicense: licMatch ? licMatch[1] : (licFileMatch ? `File: ${licFileMatch[1]}` : undefined),
      repositoryUrl: repoMatch ? repoMatch[1] : undefined,
      rawExcerpt: excerpt,
    };
  }

  if (filename === "pyproject.toml" || filename === "setup.py" || filename === "setup.cfg") {
    const raw = fs.readFileSync(filePath, "utf-8");
    const licMatch =
      raw.match(/license\s*=\s*(?:["']([^"']+)["']|\{\s*text\s*=\s*["']([^"']+)["']\})/i) ||
      raw.match(/classifier.*License\s*::\s*([^,\r\n'"]+)/i);
    const license = licMatch ? (licMatch[1] || licMatch[2]) : undefined;

    return {
      format: "python",
      declaredLicense: license?.trim(),
      rawExcerpt: excerpt,
    };
  }

  if (filename === "pom.xml") {
    const raw = fs.readFileSync(filePath, "utf-8");
    const nameMatch = raw.match(/<licenses>\s*<license>\s*<name>([^<]+)<\/name>/i);
    return {
      format: "maven",
      declaredLicense: nameMatch ? nameMatch[1].trim() : undefined,
      rawExcerpt: excerpt,
    };
  }

  if (filename === "go.mod") {
    const raw = fs.readFileSync(filePath, "utf-8");
    const moduleMatch = raw.match(/module\s+([^\r\n\s]+)/);
    return {
      format: "go",
      repositoryUrl: moduleMatch ? moduleMatch[1] : undefined,
      rawExcerpt: excerpt,
    };
  }

  return {
    format: "unknown",
    rawExcerpt: excerpt,
  };
}

/**
 * Scan README files for license, copyright, or attribution sections.
 */
export function extractReadmeLicenseStatement(filePath: string): ReadmeExtraction | null {
  if (isBinaryFile(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/);

  // Look for headings with license, copyright, or attribution
  let sectionStart = -1;
  let sectionHeading = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^#{1,4}\s+(?:license|licence|copyright|attribution|legal)/i.test(line)) {
      sectionStart = i;
      sectionHeading = line.trim();
      break;
    }
  }

  if (sectionStart === -1) {
    // Check if the word "license" is mentioned with substantial text
    for (let i = 0; i < lines.length; i++) {
      if (/licensed under|under the (?:mit|apache|gpl|bsd|isc) license/i.test(lines[i])) {
        sectionStart = Math.max(0, i - 1);
        sectionHeading = "Inline license statement";
        break;
      }
    }
  }

  if (sectionStart === -1) {
    return null;
  }

  const excerpt = readBoundedExcerpt(filePath, sectionStart + 1, 30, 1500);

  return {
    hasLicenseSection: true,
    sectionHeading,
    excerpt,
  };
}
