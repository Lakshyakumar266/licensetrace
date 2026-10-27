# LicenseTrace — Prior Art and Differentiation Analysis

**Status:** Completed Evaluation (M0 Gate)  
**Date:** October 2026

## 1. Executive Summary

License compliance and software provenance tooling have mature ecosystems. However, existing tools generally optimize for one of two extremes:
1. **Static code/manifest scanners** (e.g., ScanCode Toolkit, FOSSology Nomos) that classify tokens or text in a single checkout snapshot without reconstructing Git evolutionary history or handling contradictory signals across repository layers.
2. **SCA & CI/CD gating tools** (e.g., FOSSA CLI, Snyk, OSV-Scanner) that parse package dependency manifests to flag copyleft risks against a corporate policy rulebook.

Neither category provides an **evidence-first, read-only forensic investigation workflow** for cases where a repository has missing licenses, conflicting headers across source files, divergent forks, or historical additions/deletions across commits—without making unqualified, non-lawyer legal claims.

LicenseTrace bridges this gap by combining deterministic local collection (filesystem signals + Git history + bounded excerpts + content hashing) with a strict evidence citation model (`E-xxxx`), explicit conflict preservation, and rigorous non-inference guarantees.

---

## 2. Comparative Matrix

| Capability / Attribute | ScanCode Toolkit (nexB) | FOSSology (Linux Foundation) | FOSSA CLI / SCA Tools | Software Heritage (SWH) | LicenseTrace |
|---|---|---|---|---|---|
| **Primary Focus** | Deep file & snippet license/copyright detection | Comprehensive compliance suite & SBOM generator | Transitive dependency policy enforcement & CI gating | Universal archival & persistent code identification | Forensic audit of ambiguous, missing, or conflicting license evidence |
| **Input Surface** | Filesystem directory or archive | Uploaded tarballs, Git clones, package repos | Repository manifests (`package.json`, lockfiles) | VCS commits, origins, directories | Working directory, Git history, local archives, optional remotes |
| **Git History Tracing** | ❌ Snapshot-only (requires custom wrapper scripting) | ⚠️ Diff scans across releases; no automated commit-by-commit forensic chain | ⚠️ Tracks branch commits for CI run metadata | ✅ Complete VCS graph preservation (SWHID) | ✅ Deterministic path history, rename tracking, addition/removal timelines |
| **Contradictory Signal Handling** | Lists all detected licenses; downstream tool must interpret | Flags multiple matches; user manually resolves in web UI | Flags policy violation or picks top match | Stores raw content without interpretation | ✅ Explicitly preserves contradictions as first-class `mixed` findings; never silently collapses |
| **Missing License Handling** | Returns no license match | Flags as "No_license_found" | Reports unknown or unmanaged | Stores objects without license evaluation | ✅ Emits `insufficient` status; explicitly states "no explicit license grant established" |
| **Safety & Legal Disclaimers** | Technical detection tool (no legal advice) | Open source project with standard warranty disclaimer | Commercial SLA / risk ratings | Archival service | ✅ Hardcoded constraint against "safe to use", "permissible", or clearance claims |
| **Evidence Traceability** | JSON with line numbers & score percentages | Database records linked to file uploads | Dependency trees and CVE/license IDs | Cryptographic hashes & SWHIDs | ✅ Every finding cites stable `E-xxxx` evidence IDs with bounded line ranges & digests |
| **Adversarial / Untrusted Content Handling** | Scans text as tokens | Scans text as tokens | Scans metadata | Preserves raw blobs | ✅ Explicit prompt-injection containment; repository content treated strictly as untrusted data |
| **Agent / Workflow Integration** | CLI only | Web UI, REST API, CLI | CLI, Webhook, CI Action | REST API | ✅ Portable Agent Skill (`SKILL.md`) + standalone deterministic CLI |

---

## 3. Deep-Dive on Specific Prior Art

### A. ScanCode Toolkit (nexB)
- **Strengths:** Industry gold standard for license expression accuracy and comprehensive rule databases.
- **Limitations for Forensic Auditing:** ScanCode inspects a static directory tree. It does not inspect Git commit logs, determine when a license was introduced relative to original code, detect if a `LICENSE` file was renamed or deleted between commits, or cross-reference package manifests against source headers into a structured conflict report.
- **LicenseTrace Relationship:** LicenseTrace does not attempt to reimplement ScanCode's massive regex database. Instead, LicenseTrace provides bounded extraction of candidate license files, headers, and package declarations, linking them to VCS timeline facts.

### B. FOSSology (Linux Foundation)
- **Strengths:** Industrial-strength SBOM creation, multi-engine scanning (Nomos, Monk, Ojo), and compliance team workflows.
- **Limitations for Forensic Auditing:** Heavyweight infrastructure requirement (PostgreSQL, Docker/daemon). Geared toward post-release clearinghouses rather than lightweight, local, immediate investigation by a developer or automated agent reviewing a pull request or fork.
- **LicenseTrace Relationship:** LicenseTrace is zero-daemon, offline-first, portable, and runs instantly in seconds using standard Git and Bun.

### C. Software Heritage (SWH)
- **Strengths:** World-class cryptographic archive of software source code; persistent SWHIDs for files, directories, releases, and revisions.
- **Limitations for Forensic Auditing:** SWH is a storage and archival infrastructure; it does not synthesize whether a repository's current state contradicts its README or package metadata, nor does it generate an investigative report on licensing ambiguities.
- **LicenseTrace Relationship:** Software Heritage is an ideal complementary upstream source for P1 optional archive lookups.

---

## 4. Specific Gap Addressed by LicenseTrace

When an engineer asks:
> *"This repository has no root LICENSE file, but an old commit message mentions MIT, the package.json says BSD-3-Clause, and three source files have Apache-2.0 headers. What is the evidence, and did a previous author license this code?"*

Existing tools fail this question:
- A scanner will list 3 disparate licenses without explaining the temporal sequence or package discrepancy.
- A naive AI agent will guess, hallucinate commit hashes, or declare the project "safe under MIT".
- An SCA tool will look only at `package.json` and report "BSD-3-Clause".

**LicenseTrace solves this by:**
1. Deterministically collecting the exact Git commit where the notice was mentioned.
2. Collecting the exact package manifest field.
3. Collecting the source headers with bounded line numbers.
4. Preserving the contradiction with evidence IDs.
5. Reporting status as `mixed` or `insufficient`, with explicit notice that no unified permission was established.
