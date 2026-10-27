# LicenseTrace — Evidence Schema Reference

**Version:** 0.1.0  
**Status:** Normative Specification

This document defines the machine-readable schema for LicenseTrace evidence bundles (`evidence.json`) and run manifests (`manifest.json`).

---

## 1. Top-Level Evidence Bundle (`evidence.json`)

```typescript
export interface EvidenceBundle {
  schema_version: "0.1.0";
  manifest: RunManifest;
  evidence: EvidenceRecord[];
  findings: Finding[];
  conflicts: ConflictRecord[];
}
```

---

## 2. EvidenceRecord Schema

Each piece of discovered evidence is assigned a stable identifier within a run (e.g., `E-0001`, `E-0002`).

```typescript
export type EvidenceKind =
  | "license_file"
  | "source_header"
  | "package_metadata"
  | "readme_statement"
  | "git_commit"
  | "remote_metadata"
  | "release_artifact"
  | "archive_record"
  | "hash_comparison"
  | "other";

export type EvidenceClassification =
  | "direct"
  | "corroborating"
  | "contradictory"
  | "context_only"
  | "unverified_lead";

export interface ContentHash {
  algorithm: "sha256" | "sha1" | "md5";
  digest: string;
}

export interface RetrievalMetadata {
  method: string; // e.g. "filesystem_read", "git_log", "git_remote", "opt_in_http_get"
  status: "succeeded" | "failed" | "skipped";
  message?: string;
}

export interface EvidenceRecord {
  id: string; // Regex: ^E-\d{4}$
  kind: EvidenceKind;
  classification: EvidenceClassification;
  claim: string; // Narrow, factual claim supported directly by this item
  source: string; // Relative file path, commit hash, or URL
  locator: string; // Line range (e.g. "L1-L25"), commit hash, tag name, etc.
  observed_at: string; // ISO 8601 UTC timestamp
  content_hash?: ContentHash;
  excerpt: string; // Bounded excerpt (maximum 50 lines / 2000 chars)
  limitations: string; // What this evidence item CANNOT establish
  retrieval: RetrievalMetadata;
}
```

---

## 3. Finding Schema

Findings synthesize observations across one or more evidence records.

```typescript
export type ReportStatus =
  | "supported"
  | "mixed"
  | "insufficient"
  | "not_assessed";

export interface Finding {
  id: string; // Regex: ^F-\d{4}$
  statement: string; // Factual observation
  status: ReportStatus;
  evidence_ids: string[]; // Must all resolve to valid EvidenceRecord.id
  conflicting_evidence_ids?: string[];
  inferences_and_limitations: string;
}
```

---

## 4. ConflictRecord Schema

```typescript
export interface ConflictRecord {
  id: string; // Regex: ^C-\d{4}$
  description: string;
  conflicting_evidence_ids: string[]; // At least 2 evidence IDs
  resolution_status: "unresolved" | "preservation_required";
}
```

---

## 5. RunManifest Schema (`manifest.json`)

```typescript
export interface RunManifest {
  run_id: string;
  tool_name: "licensetrace";
  tool_version: string;
  target_path: string;
  target_revision: string | null; // Git commit SHA or null if not a Git repo
  is_git_repository: boolean;
  shallow_history: boolean;
  options: {
    offline: boolean;
    network: boolean;
    output_dir: string;
    include_history: boolean;
    max_file_size_bytes: number;
    max_history_commits: number;
  };
  started_at: string;
  completed_at: string;
  collection_summary: {
    evidence_count: number;
    findings_count: number;
    conflicts_count: number;
    failed_collections: number;
  };
}
```

---

## 6. Validation Constraints

1. Every `evidence_ids` reference in a `Finding` or `ConflictRecord` must match an existing `EvidenceRecord.id`.
2. No finding status may be `supported` without at least one linked evidence ID.
3. Excerpts are bounded to prevent memory exhaustion and token flooding (max 2,000 characters).
4. Raw content containing shell control codes or invalid UTF-8 must be sanitized or skipped with a descriptive retrieval limitation.
5. Repository content must never be executed or parsed as code execution instructions.
