import * as path from "node:path";
import { executeCommand } from "./util/process.js";
import { normalizePath } from "./util/paths.js";

export interface GitRemoteInfo {
  name: string;
  url: string;
  type: "fetch" | "push";
}

export interface GitCommitRecord {
  hash: string;
  author: string;
  date: string;
  subject: string;
  status?: string; // "A" (Added), "M" (Modified), "D" (Deleted), "R" (Renamed)
  filePath?: string;
  oldPath?: string;
}

export interface GitPathHistory {
  path: string;
  commits: GitCommitRecord[];
  firstAdded?: GitCommitRecord;
  lastModified?: GitCommitRecord;
  wasDeleted?: boolean;
}

export interface GitRepositoryInfo {
  isGitRepo: boolean;
  targetRoot: string;
  currentRevision: string | null;
  currentBranch: string | null;
  isShallow: boolean;
  remotes: GitRemoteInfo[];
  pathHistories: GitPathHistory[];
  collectionErrors: string[];
}

/**
 * Inspect Git metadata and history for candidate files in a repository.
 */
export async function collectGitInfo(
  targetRoot: string,
  candidatePaths: string[] = [],
  maxCommits: number = 50
): Promise<GitRepositoryInfo> {
  const root = path.resolve(targetRoot);
  const errors: string[] = [];

  // 1. Verify Git is inside work tree
  const checkRepo = await executeCommand({
    cmd: ["git", "rev-parse", "--is-inside-work-tree"],
    cwd: root,
  });

  if (checkRepo.exitCode !== 0 || checkRepo.stdout.trim() !== "true") {
    return {
      isGitRepo: false,
      targetRoot: root,
      currentRevision: null,
      currentBranch: null,
      isShallow: false,
      remotes: [],
      pathHistories: [],
      collectionErrors: checkRepo.stderr
        ? [checkRepo.stderr.trim()]
        : ["Not a Git repository"],
    };
  }

  // 2. Current revision
  const revCheck = await executeCommand({
    cmd: ["git", "rev-parse", "HEAD"],
    cwd: root,
  });
  const currentRevision = revCheck.exitCode === 0 ? revCheck.stdout.trim() : null;
  if (!currentRevision) {
    errors.push("Failed to get HEAD revision (repository may have no commits)");
  }

  // 3. Current branch
  const branchCheck = await executeCommand({
    cmd: ["git", "branch", "--show-current"],
    cwd: root,
  });
  const currentBranch = branchCheck.exitCode === 0 ? branchCheck.stdout.trim() : null;

  // 4. Shallow repository check
  const shallowCheck = await executeCommand({
    cmd: ["git", "rev-parse", "--is-shallow-repository"],
    cwd: root,
  });
  const isShallow =
    shallowCheck.exitCode === 0 && shallowCheck.stdout.trim() === "true";

  // 5. Remotes
  const remotesCheck = await executeCommand({
    cmd: ["git", "remote", "-v"],
    cwd: root,
  });
  const remotes: GitRemoteInfo[] = [];
  if (remotesCheck.exitCode === 0) {
    const lines = remotesCheck.stdout.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const match = line.match(/^(\S+)\s+(\S+)\s+\((\w+)\)$/);
      if (match) {
        remotes.push({
          name: match[1],
          url: match[2],
          type: match[3] === "push" ? "push" : "fetch",
        });
      }
    }
  }

  // 6. Path history for candidate paths
  const pathHistories: GitPathHistory[] = [];

  for (const relPath of candidatePaths) {
    const normalized = normalizePath(relPath);
    // Use format: commit_hash|author|iso_date|subject
    const logCheck = await executeCommand({
      cmd: [
        "git",
        "log",
        "--follow",
        "--name-status",
        `--max-count=${maxCommits}`,
        "--format=COMMIT:%H|%an|%aI|%s",
        "--",
        normalized,
      ],
      cwd: root,
    });

    if (logCheck.exitCode !== 0) {
      errors.push(`git log failed for ${normalized}: ${logCheck.stderr.trim()}`);
      continue;
    }

    const commits: GitCommitRecord[] = [];
    const lines = logCheck.stdout.split(/\r?\n/);
    let currentCommit: Partial<GitCommitRecord> | null = null;

    for (const line of lines) {
      if (line.startsWith("COMMIT:")) {
        if (currentCommit?.hash) {
          commits.push(currentCommit as GitCommitRecord);
        }
        const [hash, author, date, subject] = line.slice(7).split("|");
        currentCommit = {
          hash: hash || "",
          author: author || "unknown",
          date: date || "",
          subject: subject || "",
        };
      } else if (currentCommit && line.trim()) {
        const statusMatch = line.trim().match(/^([A-Z])(?:\d+)?\s+(\S+)(?:\s+(\S+))?$/);
        if (statusMatch) {
          currentCommit.status = statusMatch[1];
          if (statusMatch[3]) {
            currentCommit.oldPath = statusMatch[2];
            currentCommit.filePath = statusMatch[3];
          } else {
            currentCommit.filePath = statusMatch[2];
          }
        }
      }
    }

    if (currentCommit?.hash) {
      commits.push(currentCommit as GitCommitRecord);
    }

    if (commits.length > 0) {
      const firstAdded = commits[commits.length - 1]; // oldest commit in log
      const lastModified = commits[0]; // newest commit in log
      const wasDeleted = commits[0]?.status === "D";

      pathHistories.push({
        path: normalized,
        commits,
        firstAdded,
        lastModified,
        wasDeleted,
      });
    }
  }

  return {
    isGitRepo: true,
    targetRoot: root,
    currentRevision,
    currentBranch,
    isShallow,
    remotes,
    pathHistories,
    collectionErrors: errors,
  };
}

/**
 * Discover historical paths that were deleted in Git history.
 */
export async function getDeletedHistoricalPaths(targetRoot: string): Promise<string[]> {
  const root = path.resolve(targetRoot);
  const res = await executeCommand({
    cmd: ["git", "log", "--diff-filter=D", "--name-only", "--format="],
    cwd: root,
  });
  if (res.exitCode !== 0) return [];
  const lines = res.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return Array.from(new Set(lines));
}
