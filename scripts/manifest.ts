import * as crypto from "node:crypto";
import type { RunManifest } from "./schema.js";

export interface CreateManifestOptions {
  targetPath: string;
  targetRevision: string | null;
  isGitRepository: boolean;
  shallowHistory: boolean;
  offline: boolean;
  network: boolean;
  outputDir: string;
  includeHistory: boolean;
  maxFileSizeBytes?: number;
  maxHistoryCommits?: number;
}

export function createInitialManifest(options: CreateManifestOptions): RunManifest {
  const timestamp = new Date().toISOString();
  const randomSuffix = crypto.randomBytes(4).toString("hex");
  const runId = `run-${Date.now()}-${randomSuffix}`;

  return {
    run_id: runId,
    tool_name: "licensetrace",
    tool_version: "0.1.0",
    target_path: options.targetPath,
    target_revision: options.targetRevision,
    is_git_repository: options.isGitRepository,
    shallow_history: options.shallowHistory,
    options: {
      offline: options.offline,
      network: options.network,
      output_dir: options.outputDir,
      include_history: options.includeHistory,
      max_file_size_bytes: options.maxFileSizeBytes ?? 1024 * 1024,
      max_history_commits: options.maxHistoryCommits ?? 50,
    },
    started_at: timestamp,
    completed_at: timestamp,
    collection_summary: {
      evidence_count: 0,
      findings_count: 0,
      conflicts_count: 0,
      failed_collections: 0,
    },
  };
}

export function finalizeManifest(
  manifest: RunManifest,
  evidenceCount: number,
  findingsCount: number,
  conflictsCount: number,
  failedCollections: number
): RunManifest {
  return {
    ...manifest,
    completed_at: new Date().toISOString(),
    collection_summary: {
      evidence_count: evidenceCount,
      findings_count: findingsCount,
      conflicts_count: conflictsCount,
      failed_collections: failedCollections,
    },
  };
}
