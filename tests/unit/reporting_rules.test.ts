import { describe, it, expect } from "bun:test";
import { synthesizeInvestigation } from "../../scripts/report.js";
import { createInitialManifest } from "../../scripts/manifest.js";
import type { EvidenceRecord } from "../../scripts/schema.js";

describe("reporting rules compliance", () => {
  const baseManifest = createInitialManifest({
    targetPath: "/mock/repo",
    targetRevision: "1234567890",
    isGitRepository: true,
    shallowHistory: false,
    offline: true,
    network: false,
    outputDir: "/mock/repo/.licensetrace",
    includeHistory: true,
  });

  it("never outputs prohibited legal clearance phrases", () => {
    const evidence: EvidenceRecord[] = [
      {
        id: "E-0001",
        kind: "license_file",
        classification: "direct",
        claim: "LICENSE contains Apache-2.0 notice",
        source: "LICENSE",
        locator: "L1-L20",
        observed_at: new Date().toISOString(),
        excerpt: "Apache License Version 2.0",
        limitations: "Text presence does not constitute legal clearance.",
        retrieval: { method: "filesystem_read", status: "succeeded" },
      },
    ];

    const result = synthesizeInvestigation({
      manifest: baseManifest,
      evidence,
      question: "Audit repository licensing and attribution evidence",
    });

    const lowerReport = result.markdownReport.toLowerCase();

    // Check prohibited clearance terms in findings and generated body
    expect(lowerReport).not.toContain("safe to use");
    expect(lowerReport).not.toContain("permission granted");
    expect(lowerReport).not.toContain("legally cleared");
    expect(lowerReport).not.toContain("free to use");
    expect(lowerReport).not.toContain("risk-free");
  });

  it("outputs 'insufficient' and non-permission when no license is found", () => {
    const result = synthesizeInvestigation({
      manifest: baseManifest,
      evidence: [], // no license evidence
      question: "What is the license?",
    });

    expect(result.overallStatus).toBe("insufficient");
    expect(result.markdownReport).toContain("Insufficient Evidence");
    expect(result.markdownReport).toContain("no explicit permission is established");
    expect(result.markdownReport.toLowerCase()).not.toContain("public domain");
  });

  it("marks status as 'mixed' and preserves all conflicting signals", () => {
    const evidence: EvidenceRecord[] = [
      {
        id: "E-0001",
        kind: "license_file",
        classification: "direct",
        claim: "Root LICENSE file declares MIT License",
        source: "LICENSE",
        locator: "L1-L20",
        observed_at: new Date().toISOString(),
        excerpt: "MIT License\n\nPermission is hereby granted...",
        limitations: "Text only",
        retrieval: { method: "filesystem_read", status: "succeeded" },
      },
      {
        id: "E-0002",
        kind: "package_metadata",
        classification: "contradictory",
        claim: "package.json declares BSD-3-Clause",
        source: "package.json",
        locator: "L5-L7",
        observed_at: new Date().toISOString(),
        excerpt: '"license": "BSD-3-Clause"',
        limitations: "Manifest only",
        retrieval: { method: "manifest_parse", status: "succeeded" },
      },
      {
        id: "E-0003",
        kind: "source_header",
        classification: "contradictory",
        claim: "src/index.ts has Apache-2.0 header",
        source: "src/index.ts",
        locator: "L1-L5",
        observed_at: new Date().toISOString(),
        excerpt: "// SPDX-License-Identifier: Apache-2.0",
        limitations: "Header only",
        retrieval: { method: "header_scan", status: "succeeded" },
      },
    ];

    const result = synthesizeInvestigation({
      manifest: baseManifest,
      evidence,
      question: "Resolve conflicting licenses",
    });

    expect(result.overallStatus).toBe("mixed");
    expect(result.bundle.conflicts.length).toBeGreaterThan(0);
    expect(result.bundle.conflicts[0].resolution_status).toBe("preservation_required");

    // Must preserve all three evidence IDs in conflict
    const conflictIds = result.bundle.conflicts[0].conflicting_evidence_ids;
    expect(conflictIds).toContain("E-0001");
    expect(conflictIds).toContain("E-0002");
    expect(conflictIds).toContain("E-0003");
  });
});
