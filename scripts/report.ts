import type {
  EvidenceRecord,
  Finding,
  ConflictRecord,
  EvidenceBundle,
  RunManifest,
  ReportStatus,
} from "./schema.js";

export interface InvestigationScope {
  targetPath: string;
  question: string;
  optionsSummary: string;
}

export interface SynthesisInput {
  manifest: RunManifest;
  evidence: EvidenceRecord[];
  question?: string;
}

export interface SynthesisResult {
  bundle: EvidenceBundle;
  markdownReport: string;
  overallStatus: ReportStatus;
}

/**
 * Format a counter into a zero-padded string, e.g. 1 -> "0001".
 */
export function formatId(prefix: "E" | "F" | "C", index: number): string {
  return `${prefix}-${String(index).padStart(4, "0")}`;
}

/**
 * Synthesize evidence records, detect conflicts, derive findings, and generate report.
 */
export function synthesizeInvestigation(input: SynthesisInput): SynthesisResult {
  const { manifest, evidence, question = "Audit repository licensing and attribution evidence" } = input;

  const conflicts: ConflictRecord[] = [];
  const findings: Finding[] = [];
  let conflictCounter = 1;
  let findingCounter = 1;

  // 1. Group evidence by kind
  const licenseFiles = evidence.filter((e) => e.kind === "license_file");
  const packageMetas = evidence.filter((e) => e.kind === "package_metadata");
  const sourceHeaders = evidence.filter((e) => e.kind === "source_header");
  const readmeStatements = evidence.filter((e) => e.kind === "readme_statement");
  const gitCommits = evidence.filter((e) => e.kind === "git_commit");
  const comparisons = evidence.filter((e) => e.kind === "hash_comparison");

  // Check for conflicts between declared licenses
  // Extract normalized license names from claims or excerpts
  function detectLicenseToken(text: string): string | null {
    const lower = text.toLowerCase();
    if (lower.includes("apache-2.0") || lower.includes("apache 2.0") || lower.includes("apache license, version 2.0")) {
      return "Apache-2.0";
    }
    if (lower.includes("mit license") || lower.includes("mit") || lower.includes("permission is hereby granted, free of charge")) {
      return "MIT";
    }
    if (lower.includes("bsd-3-clause") || lower.includes("bsd 3-clause")) {
      return "BSD-3-Clause";
    }
    if (lower.includes("bsd-2-clause") || lower.includes("bsd 2-clause")) {
      return "BSD-2-Clause";
    }
    if (lower.includes("gpl-3.0") || lower.includes("gnu general public license")) {
      return "GPL-3.0";
    }
    if (lower.includes("mpl-2.0") || lower.includes("mozilla public license")) {
      return "MPL-2.0";
    }
    if (lower.includes("unlicense")) {
      return "Unlicense";
    }
    if (lower.includes("isc")) {
      return "ISC";
    }
    return null;
  }

  const signals: Array<{ token: string; evidenceId: string; source: string; kind: string }> = [];

  for (const item of [...licenseFiles, ...packageMetas, ...sourceHeaders, ...readmeStatements]) {
    const token = detectLicenseToken(item.claim + " " + item.excerpt);
    if (token) {
      signals.push({ token, evidenceId: item.id, source: item.source, kind: item.kind });
    }
  }

  // Find distinct tokens
  const uniqueTokens = Array.from(new Set(signals.map((s) => s.token)));

  if (uniqueTokens.length > 1) {
    // Conflict detected!
    const conflictId = formatId("C", conflictCounter++);
    const conflictingIds = Array.from(new Set(signals.map((s) => s.evidenceId)));
    const description = `Conflicting license signals observed: ${uniqueTokens
      .map((t) => `${t} (in ${signals.filter((s) => s.token === t).map((s) => s.source).join(", ")})`)
      .join(" vs ")}`;

    conflicts.push({
      id: conflictId,
      description,
      conflicting_evidence_ids: conflictingIds,
      resolution_status: "preservation_required",
    });

    findings.push({
      id: formatId("F", findingCounter++),
      statement: `Multiple conflicting license signals observed across repository layers: ${uniqueTokens.join(", ")}`,
      status: "mixed",
      evidence_ids: conflictingIds,
      conflicting_evidence_ids: conflictingIds,
      inferences_and_limitations:
        "The repository contains mutually inconsistent license statements. LicenseTrace preserves all conflicting signals and does not resolve or prioritize one declaration over another.",
    });
  }

  // Check for license file presence
  if (licenseFiles.length > 0) {
    const licIds = licenseFiles.map((e) => e.id);
    findings.push({
      id: formatId("F", findingCounter++),
      statement: `Found ${licenseFiles.length} license-like file(s) in repository: ${licenseFiles
        .map((f) => f.source)
        .join(", ")}`,
      status: "supported",
      evidence_ids: licIds,
      inferences_and_limitations:
        "Text was extracted from files matching standard license file names. The presence of a file does not constitute a legal determination of rights.",
    });
  } else {
    // No license files found
    findings.push({
      id: formatId("F", findingCounter++),
      statement: "No top-level or nested LICENSE or COPYING file was identified in the repository.",
      status: "insufficient",
      evidence_ids: [],
      inferences_and_limitations:
        "No explicit license grant was detected in the inspected filesystem scope. Under copyright law, silence retains all rights; no explicit permission is established by the inspected evidence.",
    });
  }

  // Package metadata findings
  if (packageMetas.length > 0) {
    findings.push({
      id: formatId("F", findingCounter++),
      statement: `Inspected package manifest declaration(s) in: ${packageMetas.map((p) => p.source).join(", ")}`,
      status: "supported",
      evidence_ids: packageMetas.map((p) => p.id),
      inferences_and_limitations:
        "Package manifest fields reflect declarations in package manager configurations and may differ from source code headers or repository licenses.",
    });
  }

  // Source header findings
  if (sourceHeaders.length > 0) {
    findings.push({
      id: formatId("F", findingCounter++),
      statement: `Found ${sourceHeaders.length} source file(s) containing explicit license or copyright headers`,
      status: "supported",
      evidence_ids: sourceHeaders.map((s) => s.id),
      inferences_and_limitations:
        "Source header comments reflect assertions by file authors or contributors.",
    });
  }

  // Git history findings
  if (gitCommits.length > 0) {
    findings.push({
      id: formatId("F", findingCounter++),
      statement: `Collected Git history records tracing addition/modification of license-relevant paths (${gitCommits.length} record(s))`,
      status: "supported",
      evidence_ids: gitCommits.map((g) => g.id),
      inferences_and_limitations:
        "Git commit logs reflect recorded commit history in this clone. Commits could have been amended, rebased, or truncated if history is shallow.",
    });
  }

  // Hash comparisons
  if (comparisons.length > 0) {
    findings.push({
      id: formatId("F", findingCounter++),
      statement: `Cryptographic hash comparisons performed (${comparisons.length} comparison(s))`,
      status: "supported",
      evidence_ids: comparisons.map((c) => c.id),
      inferences_and_limitations:
        "A hash match establishes exact byte equality between inputs; it does not establish authorization or copyright ownership.",
    });
  }

  // Derive overall status
  let overallStatus: ReportStatus = "supported";
  if (conflicts.length > 0) {
    overallStatus = "mixed";
  } else if (licenseFiles.length === 0 && packageMetas.length === 0 && sourceHeaders.length === 0) {
    overallStatus = "insufficient";
  } else if (!manifest.is_git_repository && evidence.length === 0) {
    overallStatus = "insufficient";
  }

  const bundle: EvidenceBundle = {
    schema_version: "0.1.0",
    manifest,
    evidence,
    findings,
    conflicts,
  };

  // Generate markdown report
  const markdownReport = generateMarkdownReport(bundle, question, overallStatus);

  return {
    bundle,
    markdownReport,
    overallStatus,
  };
}

/**
 * Generate human-readable Markdown report conforming to the PRD Section 9 schema.
 */
function generateMarkdownReport(
  bundle: EvidenceBundle,
  question: string,
  overallStatus: ReportStatus
): string {
  const { manifest, evidence, findings, conflicts } = bundle;

  const lines: string[] = [];

  // Title
  lines.push("# LicenseTrace Investigation Report");
  lines.push("");
  lines.push(`**Run ID:** \`${manifest.run_id}\`  `);
  lines.push(`**Generated At:** \`${manifest.completed_at}\`  `);
  lines.push(`**Tool Version:** \`${manifest.tool_name} v${manifest.tool_version}\`  `);
  lines.push(`**Target Path:** \`${manifest.target_path}\`  `);
  lines.push(
    `**Target Revision:** ${manifest.target_revision ? `\`${manifest.target_revision}\`` : "*Non-git repository or no commits*"}  `
  );
  lines.push(`**Shallow History:** ${manifest.shallow_history ? "⚠️ Yes (truncated history)" : "No (full clone)"}`);
  lines.push("");

  // 1. Investigation Question and Scope
  lines.push("## 1. Investigation Question and Scope");
  lines.push("");
  lines.push(`**Question:** ${question}`);
  lines.push("");
  lines.push("- **Execution Mode:** " + (manifest.options.offline ? "Offline (local filesystem and Git only)" : "Network enabled"));
  lines.push("- **History Analyzed:** " + (manifest.options.include_history ? "Yes" : "Skipped via options"));
  lines.push(`- **Max Commits Inspected:** ${manifest.options.max_history_commits}`);
  lines.push(`- **Max File Size:** ${manifest.options.max_file_size_bytes} bytes`);
  lines.push("");

  // 2. Summary Status
  lines.push("## 2. Summary Status");
  lines.push("");
  lines.push(`**Status:** \`${overallStatus}\``);
  lines.push("");
  if (overallStatus === "mixed") {
    lines.push(
      "> ⚠️ **Mixed Signals:** Contradictory license statements were detected across inspected files, metadata, or history. The conflicting signals are preserved below."
    );
  } else if (overallStatus === "insufficient") {
    lines.push(
      "> ℹ️ **Insufficient Evidence:** No explicit license grant or insufficient licensing evidence was established in the inspected scope. Under copyright law, silence retains all rights; no explicit permission is established."
    );
  } else if (overallStatus === "supported") {
    lines.push(
      "> ✅ **Supported Findings:** Observed license and attribution evidence directly corroborates the factual findings listed below. This report is an evidence summary, not legal clearance."
    );
  } else {
    lines.push("> ❓ **Not Assessed:** The requested scope was not evaluated.");
  }
  lines.push("");

  // 3. What Was Observed
  lines.push("## 3. What Was Observed");
  lines.push("");
  lines.push(`- Evidence records generated: ${evidence.length}`);
  lines.push(`- Material conflicts identified: ${conflicts.length}`);
  lines.push(`- Failed collections / errors: ${manifest.collection_summary.failed_collections}`);
  lines.push("");

  // Evidence Summary Table
  if (evidence.length > 0) {
    lines.push("### Collected Evidence Records");
    lines.push("");
    lines.push("| Evidence ID | Kind | Source | Locator | Classification | Claim |");
    lines.push("|---|---|---|---|---|---|");
    for (const e of evidence) {
      const escapedClaim = e.claim.replace(/\|/g, "\\|").slice(0, 80);
      lines.push(
        `| **${e.id}** | \`${e.kind}\` | \`${e.source}\` | \`${e.locator}\` | \`${e.classification}\` | ${escapedClaim} |`
      );
    }
    lines.push("");
  }

  // 4. Evidence-Backed Findings
  lines.push("## 4. Evidence-Backed Findings");
  lines.push("");
  if (findings.length === 0) {
    lines.push("*No findings generated.*");
  } else {
    for (const f of findings) {
      lines.push(`### [${f.id}] ${f.statement}`);
      lines.push(`- **Status:** \`${f.status}\``);
      lines.push(
        `- **Supporting Evidence:** ${f.evidence_ids.length > 0 ? f.evidence_ids.map((id) => `[${id}](#collected-evidence-records)`).join(", ") : "*None (unresolved)*"}`
      );
      if (f.conflicting_evidence_ids && f.conflicting_evidence_ids.length > 0) {
        lines.push(
          `- **Conflicting Evidence:** ${f.conflicting_evidence_ids.map((id) => `[${id}](#collected-evidence-records)`).join(", ")}`
        );
      }
      lines.push(`- **Inference & Limitations:** ${f.inferences_and_limitations}`);
      lines.push("");
    }
  }

  // 5. Conflicting Evidence
  lines.push("## 5. Conflicting Evidence");
  lines.push("");
  if (conflicts.length === 0) {
    lines.push("No material conflicts between licensing signals were detected in the inspected scope.");
  } else {
    for (const c of conflicts) {
      lines.push(`### [${c.id}] ${c.description}`);
      lines.push(
        `- **Conflicting Evidence IDs:** ${c.conflicting_evidence_ids.map((id) => `[${id}](#collected-evidence-records)`).join(", ")}`
      );
      lines.push(`- **Resolution Status:** \`${c.resolution_status}\``);
      lines.push(
        "- **Preservation Note:** LicenseTrace never silently resolves or discards conflicting licensing declarations."
      );
      lines.push("");
    }
  }
  lines.push("");

  // 6. What Remains Unknown
  lines.push("## 6. What Remains Unknown");
  lines.push("");
  if (manifest.shallow_history) {
    lines.push("- Git history is shallow; older commits prior to clone depth were not inspected.");
  }
  if (!manifest.is_git_repository) {
    lines.push("- Repository lacks Git version control; historical changes, authorship commits, and renames are unknown.");
  }
  if (manifest.options.offline) {
    lines.push("- Offline mode: external remotes, upstream repositories, package registries, and archival services were not queried.");
  }
  lines.push("- Unreviewed third-party dependencies outside repository source tree are not audited.");
  lines.push("- Legal validity, copyright chain of title, and enforceability under applicable jurisdiction remain unverified.");
  lines.push("");

  // 7. Reproduction Steps
  lines.push("## 7. Reproduction Steps");
  lines.push("");
  lines.push("To reproduce this exact collection and audit independently, execute:");
  lines.push("```bash");
  lines.push(
    `licensetrace "${manifest.target_path}" --output-dir "${manifest.options.output_dir}" ${manifest.options.offline ? "--offline" : "--network"} ${manifest.options.include_history ? "" : "--no-history"}`.trim()
  );
  lines.push("```");
  lines.push("");

  // 8. Limitations and Non-Legal-Advice Notice
  lines.push("## 8. Limitations and Non-Legal-Advice Notice");
  lines.push("");
  lines.push(
    "> **Important Notice:** LicenseTrace is an evidence organization and research tool, not a law firm or automated legal advisor. Findings in this report describe observed text, metadata, and version control records. They do not constitute legal advice, legal opinion, warranty of title, or a determination of non-infringement or permissibility. Use of software analyzed herein should be evaluated with qualified legal counsel."
  );
  lines.push("");

  return lines.join("\n");
}
