import { describe, it, expect } from "bun:test";
import { validateEvidenceBundle, type EvidenceBundle } from "../../scripts/schema.js";

describe("schema and validation", () => {
  const sampleValidBundle: EvidenceBundle = {
    schema_version: "0.1.0",
    manifest: {
      run_id: "run-test-01",
      tool_name: "licensetrace",
      tool_version: "0.1.0",
      target_path: "/test/repo",
      target_revision: "abc1234567890",
      is_git_repository: true,
      shallow_history: false,
      options: {
        offline: true,
        network: false,
        output_dir: "/test/repo/.licensetrace",
        include_history: true,
        max_file_size_bytes: 1048576,
        max_history_commits: 50,
      },
      started_at: "2026-10-28T00:00:00.000Z",
      completed_at: "2026-10-28T00:00:05.000Z",
      collection_summary: {
        evidence_count: 1,
        findings_count: 1,
        conflicts_count: 0,
        failed_collections: 0,
      },
    },
    evidence: [
      {
        id: "E-0001",
        kind: "license_file",
        classification: "direct",
        claim: "License file contains MIT text",
        source: "LICENSE",
        locator: "L1-L21",
        observed_at: "2026-10-28T00:00:00.000Z",
        content_hash: {
          algorithm: "sha256",
          digest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        },
        excerpt: "MIT License\n\nPermission is hereby granted...",
        limitations: "Text presence does not establish legal clearance.",
        retrieval: {
          method: "filesystem_read",
          status: "succeeded",
        },
      },
    ],
    findings: [
      {
        id: "F-0001",
        statement: "Root LICENSE file observed with MIT template",
        status: "supported",
        evidence_ids: ["E-0001"],
        inferences_and_limitations: "Observed text directly corroborates statement.",
      },
    ],
    conflicts: [],
  };

  it("passes validation for a valid evidence bundle", () => {
    const res = validateEvidenceBundle(sampleValidBundle);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
  });

  it("fails when finding cites a non-existent evidence ID", () => {
    const invalidBundle = JSON.parse(JSON.stringify(sampleValidBundle));
    invalidBundle.findings[0].evidence_ids = ["E-9999"];

    const res = validateEvidenceBundle(invalidBundle);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e: string) => e.includes("non-existent evidence ID 'E-9999'"))).toBe(true);
  });

  it("fails when finding has status 'supported' with empty evidence_ids", () => {
    const invalidBundle = JSON.parse(JSON.stringify(sampleValidBundle));
    invalidBundle.findings[0].evidence_ids = [];

    const res = validateEvidenceBundle(invalidBundle);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e: string) => e.includes("cites no evidence IDs"))).toBe(true);
  });

  it("fails when evidence ID has invalid format", () => {
    const invalidBundle = JSON.parse(JSON.stringify(sampleValidBundle));
    invalidBundle.evidence[0].id = "INVALID-ID";

    const res = validateEvidenceBundle(invalidBundle);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e: string) => e.includes("Evidence ID must match pattern"))).toBe(true);
  });
});
