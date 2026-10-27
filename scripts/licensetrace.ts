#!/usr/bin/env bun
import * as fs from "node:fs";
import * as path from "node:path";
import { inventoryRepository } from "./inventory.js";
import { collectGitInfo, getDeletedHistoricalPaths } from "./git.js";
import {
  readBoundedExcerpt,
  extractPackageMetadata,
  extractSourceHeader,
  extractReadmeLicenseStatement,
} from "./extract.js";
import { hashFile, compareFilesByHash } from "./util/hash.js";
import { createInitialManifest, finalizeManifest } from "./manifest.js";
import {
  synthesizeInvestigation,
  formatId,
} from "./report.js";
import {
  validateEvidenceBundle,
  type EvidenceRecord,
} from "./schema.js";
import {
  normalizePath,
  isPathInside,
  isLicenseFilename,
  isReadmeFilename,
  isPackageManifestFilename,
} from "./util/paths.js";

interface CliOptions {
  targetPath: string;
  outputDir: string;
  question: string;
  offline: boolean;
  network: boolean;
  includeHistory: boolean;
  maxCommits: number;
  maxFileSizeBytes: number;
  compareArtifact?: string;
  showHelp: boolean;
  showVersion: boolean;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    targetPath: ".",
    outputDir: ".licensetrace",
    question: "Audit repository licensing and attribution evidence",
    offline: true,
    network: false,
    includeHistory: true,
    maxCommits: 50,
    maxFileSizeBytes: 1024 * 1024,
    showHelp: false,
    showVersion: false,
  };

  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      options.showHelp = true;
    } else if (arg === "--version" || arg === "-v") {
      options.showVersion = true;
    } else if (arg === "--output-dir" || arg === "-o") {
      options.outputDir = args[++i];
    } else if (arg === "--question" || arg === "-q") {
      options.question = args[++i];
    } else if (arg === "--offline") {
      options.offline = true;
      options.network = false;
    } else if (arg === "--network") {
      options.network = true;
      options.offline = false;
    } else if (arg === "--no-history") {
      options.includeHistory = false;
    } else if (arg === "--max-commits") {
      options.maxCommits = parseInt(args[++i], 10) || 50;
    } else if (arg === "--max-file-size") {
      options.maxFileSizeBytes = parseInt(args[++i], 10) || 1024 * 1024;
    } else if (arg === "--compare") {
      options.compareArtifact = args[++i];
    } else if (!arg.startsWith("-")) {
      positional.push(arg);
    }
  }

  if (positional.length > 0) {
    options.targetPath = positional[0];
  }

  return options;
}

function printHelp() {
  console.log(`
LicenseTrace — Evidence-first software license and attribution investigation

Usage:
  licensetrace [options] [target_path]

Options:
  -o, --output-dir <dir>    Directory to store output files (default: .licensetrace)
  -q, --question <text>     Specific investigation question or scope
  --offline                 Run strictly offline (default: true)
  --network                 Enable opt-in network lookups (default: false)
  --no-history              Skip Git history and timeline extraction
  --max-commits <n>         Maximum commits to inspect per path (default: 50)
  --max-file-size <bytes>   Maximum file size to inspect (default: 1048576)
  --compare <path>          Compare a file or release artifact against target
  -h, --help                Show this help message
  -v, --version             Show version number

Examples:
  licensetrace .
  licensetrace /path/to/repo --output-dir ./audit-output
  licensetrace . --question "Why does package.json conflict with LICENSE?"
`);
}

export async function runLicenseTrace(cliArgs: string[]): Promise<number> {
  const options = parseArgs(cliArgs);

  if (options.showHelp) {
    printHelp();
    return 0;
  }

  if (options.showVersion) {
    console.log("licensetrace v0.1.0");
    return 0;
  }

  const resolvedTarget = path.resolve(options.targetPath);
  if (!fs.existsSync(resolvedTarget)) {
    console.error(`Error: Target path does not exist: ${resolvedTarget}`);
    return 1;
  }

  const resolvedOutputDir = path.resolve(options.outputDir);
  if (!fs.existsSync(resolvedOutputDir)) {
    fs.mkdirSync(resolvedOutputDir, { recursive: true });
  }

  console.log(`🔍 Investigating license evidence in: ${resolvedTarget}`);
  console.log(`📁 Output destination: ${resolvedOutputDir}`);

  // 1. Filesystem inventory
  const inventory = inventoryRepository(resolvedTarget, {
    maxFileSizeBytes: options.maxFileSizeBytes,
  });

  // 2. Git metadata & history
  let gitCandidatePaths: string[] = [];
  if (options.includeHistory) {
    const historicalDeleted = await getDeletedHistoricalPaths(resolvedTarget);
    const relevantHistorical = historicalDeleted.filter(
      (p) => isLicenseFilename(p) || isReadmeFilename(p) || isPackageManifestFilename(p)
    );

    gitCandidatePaths = Array.from(
      new Set([
        ...inventory.licenseFiles.map((f) => f.relativePath),
        ...inventory.packageManifests.map((f) => f.relativePath),
        ...inventory.readmeFiles.map((f) => f.relativePath),
        ...relevantHistorical,
      ])
    );
  }

  const gitInfo = await collectGitInfo(
    resolvedTarget,
    gitCandidatePaths,
    options.maxCommits
  );

  let initialManifest = createInitialManifest({
    targetPath: resolvedTarget,
    targetRevision: gitInfo.currentRevision,
    isGitRepository: gitInfo.isGitRepo,
    shallowHistory: gitInfo.isShallow,
    offline: options.offline,
    network: options.network,
    outputDir: resolvedOutputDir,
    includeHistory: options.includeHistory,
    maxFileSizeBytes: options.maxFileSizeBytes,
    maxHistoryCommits: options.maxCommits,
  });

  const evidence: EvidenceRecord[] = [];
  let evidenceCounter = 1;
  let failedCollections = 0;

  // 3. Extract license-like files
  for (const file of inventory.licenseFiles) {
    try {
      const excerpt = readBoundedExcerpt(file.absolutePath, 1, 60, 2500);
      const hash = hashFile(file.absolutePath);

      evidence.push({
        id: formatId("E", evidenceCounter++),
        kind: "license_file",
        classification: "direct",
        claim: `License-like file found at '${file.relativePath}' (${excerpt.totalLines} lines)`,
        source: file.relativePath,
        locator: `L${excerpt.startLine}-L${excerpt.endLine}`,
        observed_at: new Date().toISOString(),
        content_hash: hash,
        excerpt: excerpt.text,
        limitations: "Presence of text does not prove legal authorship or enforceability.",
        retrieval: {
          method: "filesystem_read",
          status: "succeeded",
        },
      });
    } catch (err) {
      failedCollections++;
      evidence.push({
        id: formatId("E", evidenceCounter++),
        kind: "license_file",
        classification: "unverified_lead",
        claim: `Failed reading candidate license file at '${file.relativePath}'`,
        source: file.relativePath,
        locator: "unknown",
        observed_at: new Date().toISOString(),
        excerpt: "",
        limitations: err instanceof Error ? err.message : String(err),
        retrieval: {
          method: "filesystem_read",
          status: "failed",
          message: String(err),
        },
      });
    }
  }

  // 4. Extract package manifests
  for (const file of inventory.packageManifests) {
    try {
      const meta = extractPackageMetadata(file.absolutePath);
      if (meta && meta.declaredLicense) {
        const hash = hashFile(file.absolutePath);
        evidence.push({
          id: formatId("E", evidenceCounter++),
          kind: "package_metadata",
          classification: "corroborating",
          claim: `Package manifest '${file.relativePath}' declares license: ${meta.declaredLicense}`,
          source: file.relativePath,
          locator: `L${meta.rawExcerpt.startLine}-L${meta.rawExcerpt.endLine}`,
          observed_at: new Date().toISOString(),
          content_hash: hash,
          excerpt: meta.rawExcerpt.text,
          limitations: "Package manifest strings may diverge from actual repository license terms.",
          retrieval: {
            method: "manifest_parse",
            status: "succeeded",
          },
        });
      }
    } catch {
      failedCollections++;
    }
  }

  // 5. Extract source headers
  for (const file of inventory.sourceFilesWithHeaders) {
    try {
      const header = extractSourceHeader(file.absolutePath);
      if (header && header.hasHeader) {
        const hash = hashFile(file.absolutePath);
        const details = [
          header.spdxId ? `SPDX: ${header.spdxId}` : "",
          header.copyrightNotice ? header.copyrightNotice : "",
          header.licenseMention ? header.licenseMention : "",
        ]
          .filter(Boolean)
          .join("; ");

        evidence.push({
          id: formatId("E", evidenceCounter++),
          kind: "source_header",
          classification: "direct",
          claim: `Source header in '${file.relativePath}': ${details}`,
          source: file.relativePath,
          locator: `L${header.excerpt.startLine}-L${header.excerpt.endLine}`,
          observed_at: new Date().toISOString(),
          content_hash: hash,
          excerpt: header.excerpt.text,
          limitations: "Header comments reflect assertions made by contributing developers.",
          retrieval: {
            method: "header_scan",
            status: "succeeded",
          },
        });
      }
    } catch {
      failedCollections++;
    }
  }

  // 6. Extract README statements
  for (const file of inventory.readmeFiles) {
    try {
      const readme = extractReadmeLicenseStatement(file.absolutePath);
      if (readme && readme.hasLicenseSection) {
        const hash = hashFile(file.absolutePath);
        evidence.push({
          id: formatId("E", evidenceCounter++),
          kind: "readme_statement",
          classification: "corroborating",
          claim: `README section '${readme.sectionHeading}' found in '${file.relativePath}'`,
          source: file.relativePath,
          locator: `L${readme.excerpt.startLine}-L${readme.excerpt.endLine}`,
          observed_at: new Date().toISOString(),
          content_hash: hash,
          excerpt: readme.excerpt.text,
          limitations: "README statements may describe informal terms or be outdated.",
          retrieval: {
            method: "readme_extract",
            status: "succeeded",
          },
        });
      }
    } catch {
      failedCollections++;
    }
  }

  // 7. Git history records
  if (gitInfo.isGitRepo) {
    for (const pathHist of gitInfo.pathHistories) {
      if (pathHist.firstAdded) {
        evidence.push({
          id: formatId("E", evidenceCounter++),
          kind: "git_commit",
          classification: "corroborating",
          claim: `File '${pathHist.path}' first recorded in commit ${pathHist.firstAdded.hash.slice(0, 7)} by ${pathHist.firstAdded.author} on ${pathHist.firstAdded.date}`,
          source: pathHist.firstAdded.hash,
          locator: pathHist.path,
          observed_at: new Date().toISOString(),
          excerpt: `Commit: ${pathHist.firstAdded.hash}\nAuthor: ${pathHist.firstAdded.author}\nDate: ${pathHist.firstAdded.date}\nSubject: ${pathHist.firstAdded.subject}`,
          limitations: "Git commits establish repository history, not independent legal ownership.",
          retrieval: {
            method: "git_log",
            status: "succeeded",
          },
        });
      }

      if (pathHist.wasDeleted && pathHist.lastModified) {
        evidence.push({
          id: formatId("E", evidenceCounter++),
          kind: "git_commit",
          classification: "contradictory",
          claim: `Historical file '${pathHist.path}' was deleted in commit ${pathHist.lastModified.hash.slice(0, 7)}`,
          source: pathHist.lastModified.hash,
          locator: pathHist.path,
          observed_at: new Date().toISOString(),
          excerpt: `Commit: ${pathHist.lastModified.hash}\nSubject: ${pathHist.lastModified.subject}`,
          limitations: "Indicates past existence of a license file that is absent from current tree.",
          retrieval: {
            method: "git_log",
            status: "succeeded",
          },
        });
      }
    }

    // Record remotes as context
    for (const remote of gitInfo.remotes) {
      if (remote.type === "fetch") {
        evidence.push({
          id: formatId("E", evidenceCounter++),
          kind: "remote_metadata",
          classification: "context_only",
          claim: `Configured Git remote '${remote.name}': ${remote.url}`,
          source: remote.url,
          locator: remote.name,
          observed_at: new Date().toISOString(),
          excerpt: `remote.${remote.name}.url=${remote.url}`,
          limitations: "Remote configuration does not establish that the remote is reachable or current.",
          retrieval: {
            method: "git_remote",
            status: "succeeded",
          },
        });
      }
    }
  }

  // 8. Artifact comparison if requested
  if (options.compareArtifact) {
    const compTarget = path.resolve(options.compareArtifact);
    const compResult = compareFilesByHash(resolvedTarget, compTarget);

    evidence.push({
      id: formatId("E", evidenceCounter++),
      kind: "hash_comparison",
      classification: compResult.outcome === "identical" ? "corroborating" : "context_only",
      claim: `Hash comparison between '${resolvedTarget}' and '${compTarget}': outcome is ${compResult.outcome}`,
      source: compTarget,
      locator: compResult.hash1?.digest || "unknown",
      observed_at: new Date().toISOString(),
      content_hash: compResult.hash1,
      excerpt: `Comparison outcome: ${compResult.outcome}\nDigest 1: ${compResult.hash1?.digest}\nDigest 2: ${compResult.hash2?.digest}`,
      limitations: "Byte equality verifies cryptographic hash match; it does not confer legal authorization.",
      retrieval: {
        method: "hash_comparison",
        status: compResult.outcome !== "not_comparable" ? "succeeded" : "failed",
        message: compResult.reason,
      },
    });
  }

  // Update manifest collection summary before synthesis
  initialManifest.collection_summary.evidence_count = evidence.length;
  initialManifest.collection_summary.failed_collections = failedCollections + gitInfo.collectionErrors.length;

  // 9. Synthesize findings and Markdown report
  const synthesis = synthesizeInvestigation({
    manifest: initialManifest,
    evidence,
    question: options.question,
  });

  // Finalize manifest with counts
  const finalManifest = finalizeManifest(
    initialManifest,
    evidence.length,
    synthesis.bundle.findings.length,
    synthesis.bundle.conflicts.length,
    failedCollections + gitInfo.collectionErrors.length
  );
  synthesis.bundle.manifest = finalManifest;

  // 10. Validate bundle against schema and constraints
  const validation = validateEvidenceBundle(synthesis.bundle);
  if (!validation.valid) {
    console.error("⚠️ Evidence bundle validation encountered issues:");
    for (const err of validation.errors) {
      console.error(`  - ${err}`);
    }
  }

  // 11. Write outputs to resolvedOutputDir
  const manifestPath = path.join(resolvedOutputDir, "manifest.json");
  const evidencePath = path.join(resolvedOutputDir, "evidence.json");
  const reportPath = path.join(resolvedOutputDir, "report.md");

  fs.writeFileSync(manifestPath, JSON.stringify(finalManifest, null, 2), "utf-8");
  fs.writeFileSync(evidencePath, JSON.stringify(synthesis.bundle, null, 2), "utf-8");
  fs.writeFileSync(reportPath, synthesis.markdownReport, "utf-8");

  console.log(`\n✅ LicenseTrace investigation completed!`);
  console.log(`📊 Summary status: ${synthesis.overallStatus}`);
  console.log(`📄 Manifest: ${manifestPath}`);
  console.log(`📦 Evidence: ${evidencePath}`);
  console.log(`📝 Report:   ${reportPath}`);

  return 0;
}

if (import.meta.main) {
  runLicenseTrace(process.argv.slice(2)).then((code) => {
    process.exit(code);
  });
}
