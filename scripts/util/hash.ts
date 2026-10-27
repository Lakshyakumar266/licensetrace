import * as crypto from "node:crypto";
import * as fs from "node:fs";

export interface HashResult {
  algorithm: "sha256" | "sha1" | "md5";
  digest: string;
}

export type ComparisonOutcome = "identical" | "different" | "not_comparable";

export interface HashComparisonResult {
  outcome: ComparisonOutcome;
  source1: string;
  hash1?: HashResult;
  source2: string;
  hash2?: HashResult;
  reason?: string;
}

/**
 * Compute hash of a string buffer.
 */
export function hashString(
  content: string | Buffer,
  algorithm: "sha256" | "sha1" | "md5" = "sha256"
): HashResult {
  const hash = crypto.createHash(algorithm);
  hash.update(content);
  return {
    algorithm,
    digest: hash.digest("hex"),
  };
}

/**
 * Compute hash of a file on disk in a bounded, streaming manner.
 */
export function hashFile(
  filePath: string,
  algorithm: "sha256" | "sha1" | "md5" = "sha256"
): HashResult {
  const fileBuffer = fs.readFileSync(filePath);
  return hashString(fileBuffer, algorithm);
}

/**
 * Compare two files or buffers by cryptographic hash.
 */
export function compareFilesByHash(
  path1: string,
  path2: string,
  algorithm: "sha256" | "sha1" | "md5" = "sha256"
): HashComparisonResult {
  try {
    if (!fs.existsSync(path1)) {
      return {
        outcome: "not_comparable",
        source1: path1,
        source2: path2,
        reason: `File does not exist: ${path1}`,
      };
    }
    if (!fs.existsSync(path2)) {
      return {
        outcome: "not_comparable",
        source1: path1,
        source2: path2,
        reason: `File does not exist: ${path2}`,
      };
    }

    const hash1 = hashFile(path1, algorithm);
    const hash2 = hashFile(path2, algorithm);

    return {
      outcome: hash1.digest === hash2.digest ? "identical" : "different",
      source1: path1,
      hash1,
      source2: path2,
      hash2,
    };
  } catch (err) {
    return {
      outcome: "not_comparable",
      source1: path1,
      source2: path2,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
