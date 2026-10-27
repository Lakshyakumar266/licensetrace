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

export const VALID_EVIDENCE_KINDS: Set<EvidenceKind> = new Set([
  "license_file",
  "source_header",
  "package_metadata",
  "readme_statement",
  "git_commit",
  "remote_metadata",
  "release_artifact",
  "archive_record",
  "hash_comparison",
  "other",
]);

export type EvidenceClassification =
  | "direct"
  | "corroborating"
  | "contradictory"
  | "context_only"
  | "unverified_lead";

export const VALID_CLASSIFICATIONS: Set<EvidenceClassification> = new Set([
  "direct",
  "corroborating",
  "contradictory",
  "context_only",
  "unverified_lead",
]);

export type ReportStatus =
  | "supported"
  | "mixed"
  | "insufficient"
  | "not_assessed";

export const VALID_REPORT_STATUSES: Set<ReportStatus> = new Set([
  "supported",
  "mixed",
  "insufficient",
  "not_assessed",
]);

export interface ContentHash {
  algorithm: "sha256" | "sha1" | "md5";
  digest: string;
}

export interface RetrievalMetadata {
  method: string;
  status: "succeeded" | "failed" | "skipped";
  message?: string;
}

export interface EvidenceRecord {
  id: string; // Pattern: E-XXXX
  kind: EvidenceKind;
  classification: EvidenceClassification;
  claim: string;
  source: string;
  locator: string;
  observed_at: string;
  content_hash?: ContentHash;
  excerpt: string;
  limitations: string;
  retrieval: RetrievalMetadata;
}

export interface Finding {
  id: string; // Pattern: F-XXXX
  statement: string;
  status: ReportStatus;
  evidence_ids: string[];
  conflicting_evidence_ids?: string[];
  inferences_and_limitations: string;
}

export interface ConflictRecord {
  id: string; // Pattern: C-XXXX
  description: string;
  conflicting_evidence_ids: string[];
  resolution_status: "unresolved" | "preservation_required";
}

export interface RunManifest {
  run_id: string;
  tool_name: "licensetrace";
  tool_version: string;
  target_path: string;
  target_revision: string | null;
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

export interface EvidenceBundle {
  schema_version: "0.1.0";
  manifest: RunManifest;
  evidence: EvidenceRecord[];
  findings: Finding[];
  conflicts: ConflictRecord[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const EVIDENCE_ID_REGEX = /^E-\d{4}$/;
const FINDING_ID_REGEX = /^F-\d{4}$/;
const CONFLICT_ID_REGEX = /^C-\d{4}$/;

/**
 * Native, zero-dependency validation for EvidenceBundle ensuring schema
 * correctness and cross-reference integrity.
 */
export function validateEvidenceBundle(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Data is not an object"] };
  }

  const bundle = data as Partial<EvidenceBundle>;

  if (bundle.schema_version !== "0.1.0") {
    errors.push(`Invalid schema_version: expected '0.1.0', got '${bundle.schema_version}'`);
  }

  if (!bundle.manifest || typeof bundle.manifest !== "object") {
    errors.push("Missing or invalid manifest in evidence bundle");
    return { valid: false, errors };
  }

  if (!Array.isArray(bundle.evidence)) {
    errors.push("Missing or invalid evidence array");
    return { valid: false, errors };
  }

  if (!Array.isArray(bundle.findings)) {
    errors.push("Missing or invalid findings array");
    return { valid: false, errors };
  }

  if (!Array.isArray(bundle.conflicts)) {
    errors.push("Missing or invalid conflicts array");
    return { valid: false, errors };
  }

  const evidenceIds = new Set<string>();

  for (const item of bundle.evidence) {
    if (!item.id || !EVIDENCE_ID_REGEX.test(item.id)) {
      errors.push(`Evidence ID must match pattern E-XXXX, got: '${item.id}'`);
    } else {
      if (evidenceIds.has(item.id)) {
        errors.push(`Duplicate evidence ID found: '${item.id}'`);
      }
      evidenceIds.add(item.id);
    }

    if (!VALID_EVIDENCE_KINDS.has(item.kind)) {
      errors.push(`Invalid evidence kind '${item.kind}' for item ${item.id}`);
    }

    if (!VALID_CLASSIFICATIONS.has(item.classification)) {
      errors.push(`Invalid classification '${item.classification}' for item ${item.id}`);
    }

    if (!item.claim) errors.push(`Evidence ${item.id} is missing a claim`);
    if (!item.source) errors.push(`Evidence ${item.id} is missing a source`);
    if (!item.locator) errors.push(`Evidence ${item.id} is missing a locator`);

    if (item.excerpt && item.excerpt.length > 4000) {
      errors.push(`Excerpt for evidence ${item.id} exceeds 4000 character limit`);
    }

    if (!item.retrieval || !item.retrieval.method || !item.retrieval.status) {
      errors.push(`Evidence ${item.id} has invalid retrieval metadata`);
    }
  }

  for (const finding of bundle.findings) {
    if (!finding.id || !FINDING_ID_REGEX.test(finding.id)) {
      errors.push(`Finding ID must match pattern F-XXXX, got: '${finding.id}'`);
    }

    if (!VALID_REPORT_STATUSES.has(finding.status)) {
      errors.push(`Invalid finding status '${finding.status}' in finding ${finding.id}`);
    }

    if (!Array.isArray(finding.evidence_ids)) {
      errors.push(`Finding ${finding.id} evidence_ids must be an array`);
      continue;
    }

    if (finding.status === "supported" && finding.evidence_ids.length === 0) {
      errors.push(`Integrity Error: Finding ${finding.id} has status 'supported' but cites no evidence IDs`);
    }

    for (const eid of finding.evidence_ids) {
      if (!evidenceIds.has(eid)) {
        errors.push(
          `Integrity Error: Finding ${finding.id} cites non-existent evidence ID '${eid}'`
        );
      }
    }

    if (finding.conflicting_evidence_ids) {
      for (const eid of finding.conflicting_evidence_ids) {
        if (!evidenceIds.has(eid)) {
          errors.push(
            `Integrity Error: Finding ${finding.id} cites non-existent conflicting evidence ID '${eid}'`
          );
        }
      }
    }
  }

  for (const conflict of bundle.conflicts) {
    if (!conflict.id || !CONFLICT_ID_REGEX.test(conflict.id)) {
      errors.push(`Conflict ID must match pattern C-XXXX, got: '${conflict.id}'`);
    }

    if (!Array.isArray(conflict.conflicting_evidence_ids) || conflict.conflicting_evidence_ids.length < 2) {
      errors.push(`Conflict ${conflict.id} must cite at least two conflicting evidence records`);
      continue;
    }

    for (const eid of conflict.conflicting_evidence_ids) {
      if (!evidenceIds.has(eid)) {
        errors.push(
          `Integrity Error: Conflict ${conflict.id} cites non-existent evidence ID '${eid}'`
        );
      }
    }
  }

  if (bundle.manifest.collection_summary.evidence_count !== bundle.evidence.length) {
    errors.push(
      `Manifest Mismatch: manifest.evidence_count (${bundle.manifest.collection_summary.evidence_count}) does not match bundle.evidence.length (${bundle.evidence.length})`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
