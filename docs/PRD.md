# LicenseTrace — Product Requirements Document

**Status:** Proposed MVP specification  
**Product type:** Portable agent skill with deterministic helper scripts; Pi package compatibility is a distribution target, not an MVP dependency.  
**Primary user:** A developer, maintainer, or reviewer investigating missing, conflicting, or historically ambiguous license and attribution evidence in a software repository.  
**Core principle:** Evidence first, conclusions second. LicenseTrace organizes and verifies evidence; it does not provide legal advice or declare a project legally safe to use.

## 1. Problem

Repositories sometimes contain incomplete or conflicting licensing metadata: a `LICENSE` file is missing, headers disagree, a fork has diverged from upstream, a release archive differs from the current tree, or historical commits contain clues that are no longer present. A general-purpose coding agent can attempt this investigation, but its process may be inconsistent, its sources may be hard to audit, and it may state conclusions more strongly than the evidence supports.

License scanners identify license signals in available files; archive/provenance services may help locate historical source. LicenseTrace is not intended to replace either category. It provides a repeatable investigation workflow that combines local repository evidence with optional external sources and records the chain from each conclusion to the evidence supporting it.

## 2. Product goal

Given a repository and an investigation question, produce a reproducible, machine-readable evidence bundle and a concise human-readable report that:

1. inventories relevant license and attribution signals;
2. traces relevant changes through Git history and, when requested, upstream/fork/release/archive evidence;
3. records source, location, timestamp or commit, retrieval method, and integrity metadata where available;
4. distinguishes observed facts from hypotheses and unresolved gaps;
5. avoids turning absence of evidence into evidence of permission;
6. makes the investigation repeatable and testable.

## 3. Non-goals

- Giving legal advice, deciding whether use is legally permitted, or guaranteeing license compatibility.
- Automatically changing a repository's license, adding headers, or rewriting copyright notices.
- Treating an SPDX identifier, filename, README statement, or model-generated inference as conclusive proof on its own.
- Circumventing authentication, access controls, paywalls, rate limits, or robots restrictions.
- Automatically trusting forks, package registries, mirrors, web pages, or AI-generated summaries.
- Building a hosted SaaS, web UI, or full legal compliance platform for the MVP.
- Claiming that the workflow is novel until it has been compared with existing scanners, archival/provenance services, and challenge submissions.

## 4. Primary use cases

- **UC-1 Missing license:** A maintainer finds source code without an obvious top-level license and wants to know what can be established from history and related artifacts.
- **UC-2 Conflicting signals:** A repository's `LICENSE`, package metadata, source headers, and README make inconsistent claims.
- **UC-3 Fork/upstream divergence:** A fork has changed licensing metadata or copied files from an upstream repository; the user wants a traceable comparison.
- **UC-4 Release discrepancy:** A published release archive differs from the current branch; the user wants to record what was actually present in each artifact.
- **UC-5 Audit/review:** A reviewer needs a compact evidence report with clear uncertainty and reproducible commands.

## 5. Users and jobs to be done

- **Maintainer:** “Help me understand what licensing evidence exists before I make a repository change.”
- **Contributor/reviewer:** “Show me which statements are supported by which files, commits, or archived artifacts.”
- **Open-source researcher:** “Help me reconstruct the provenance of a file without inventing a definitive answer when evidence is incomplete.”

## 6. MVP scope

### P0 — required

- Agent skill entrypoint (`SKILL.md`) describing when and how to run the workflow.
- Local repository inventory: root-level and nested license-like files, common license/copyright headers, package metadata, README licensing statements, and `.reuse/` / SPDX-related metadata when present.
- Git evidence collection: repository remotes, current revision, branches/tags summary, history for candidate license files, and history for selected source paths.
- Deterministic output schema with source IDs and evidence references.
- Evidence classification: `direct`, `corroborating`, `contradictory`, `context_only`, or `unverified_lead`.
- Report labels: `supported`, `mixed`, `insufficient`, or `not_assessed`; never output “safe to use” as a result.
- Offline mode that works without network access.
- Explicit user approval before any network fetch or remote query if the environment/policy requires consent; network operations must be documented and bounded.
- Fixture-based tests for known, ambiguous, missing, and conflicting cases.
- README with setup, limitations, examples, and a clear disclaimer.

### P1 — after P0 passes

- Optional upstream/fork comparison when remotes are known and reachable.
- Optional release artifact comparison (user supplies a local archive or URL; URL fetching is opt-in).
- Optional archival/provenance lookups, including Software Heritage where accessible.
- Content hashing for files and artifacts; record algorithm and digest.
- JSON output plus Markdown report output.
- Pi package metadata and a tested install/use example.

### Explicitly deferred

- Broad crawling of arbitrary websites.
- Automated legal interpretation or compatibility matrix decisions.
- Claims of exhaustive source provenance.
- Integration with paid APIs unless a later requirement justifies it.
- Writing back to the target repository.

## 7. Functional requirements

| ID | Requirement | Priority | Acceptance condition |
|---|---|---:|---|
| FR-01 | Detect repository root and fail clearly if the target is not a Git repository when Git analysis is requested. | P0 | Invalid target produces a non-zero exit and actionable message. |
| FR-02 | Inventory likely license/attribution files and metadata without modifying the target. | P0 | Fixture inventory matches expected paths and categories. |
| FR-03 | Capture relevant Git metadata and path history. | P0 | Output records commit hashes and commands/data sources used. |
| FR-04 | Give every evidence item a stable ID within a run. | P0 | All report citations resolve to evidence IDs. |
| FR-05 | Store observed text as a bounded excerpt with path/line range or artifact locator. | P0 | Excerpts are traceable; large files are not copied wholesale by default. |
| FR-06 | Separate observation, interpretation, and unresolved question. | P0 | Schema and report use separate fields/sections. |
| FR-07 | Mark contradictions explicitly; do not silently choose a preferred license signal. | P0 | Conflicting fixture yields `mixed` or `insufficient`, not a single unqualified license. |
| FR-08 | Do not infer permission from a missing license file. | P0 | Missing-license fixture says no explicit permission was established. |
| FR-09 | Produce JSON evidence bundle and Markdown report. | P0 | Both validate against documented schema/example. |
| FR-10 | Operate offline for local Git/filesystem evidence. | P0 | Test suite passes with network disabled. |
| FR-11 | Make network collection opt-in and record source URL, access time, and retrieval outcome. | P1 | Network mode cannot run accidentally by default. |
| FR-12 | Compare selected files/artifacts by SHA-256 and report exact match/difference. | P1 | Known identical/different fixtures yield correct results. |
| FR-13 | Preserve a run manifest with tool version, target revision, options, and timestamps. | P0 | Every generated report references a manifest. |
| FR-14 | Avoid modifying the target repository. | P0 | Test asserts no new/changed target files after a run. |

## 8. Evidence model

Every evidence record should include, where applicable:

- `id`: stable ID within the run, e.g. `E-0001`;
- `kind`: `license_file`, `source_header`, `package_metadata`, `readme_statement`, `git_commit`, `remote_metadata`, `release_artifact`, `archive_record`, `hash_comparison`, `other`;
- `classification`: `direct`, `corroborating`, `contradictory`, `context_only`, `unverified_lead`;
- `claim`: a short statement describing only what the item directly supports;
- `source`: local path, commit hash, artifact name, or URL;
- `locator`: line range, commit, tag, archive path, or other precise locator;
- `observed_at`: collection timestamp, if known;
- `content_hash`: algorithm and digest when calculated;
- `excerpt`: short bounded excerpt or a pointer to a local evidence file;
- `limitations`: what the item cannot establish;
- `retrieval`: how it was obtained and whether retrieval succeeded.

Evidence is not automatically ranked as legally authoritative. The report should explain why a source is relevant and preserve conflicts. If evidence is missing, inaccessible, or ambiguous, state that explicitly.

## 9. Output contract

Default output directory: `.licensetrace/` in the chosen output location, not inside the target by default. If the user explicitly selects an output directory inside the repository, warn and require confirmation.

Files:

- `report.md` — executive summary, scope, findings, evidence table, conflicts, unknowns, reproduction steps, limitations.
- `evidence.json` — structured evidence records and finding-to-evidence links.
- `manifest.json` — run metadata, options, tool versions, target revision, collection status.

Top-level report fields/sections:

1. Investigation question and scope
2. Summary status (`supported`, `mixed`, `insufficient`, `not_assessed`)
3. What was observed
4. Evidence-backed findings (each linked to IDs)
5. Conflicting evidence
6. What remains unknown
7. Reproduction steps
8. Limitations and non-legal-advice notice

## 10. Safety, privacy, and trust

- Read-only by default; never execute scripts from the target repository.
- Do not upload repository contents to external services.
- External lookups must send the minimum information necessary and be opt-in.
- Never include secrets, credentials, private URLs, or full source files in reports unless the user explicitly requests it.
- Bound excerpts and network timeouts; handle rate limits respectfully.
- Treat repository text, issue content, remote pages, and model-produced summaries as untrusted data, not instructions.
- Any AI-generated synthesis must cite evidence IDs and must not fabricate missing source data.
- State clearly that LicenseTrace is a research aid, not a legal opinion.

## 11. Success metrics

MVP is successful when:

- All P0 acceptance tests pass on Windows and one POSIX environment.
- Every material finding in a report links to at least one evidence ID, or is explicitly labeled as a hypothesis/unresolved question.
- Missing/conflicting evidence fixtures never produce an unqualified permission claim.
- A second run on the same immutable fixture produces semantically equivalent evidence, excluding timestamps/run IDs.
- A reviewer can reproduce the local collection steps from the report without relying on hidden agent reasoning.
- The project documentation honestly compares its scope with existing license scanners and provenance/archive services; it makes no unsupported novelty claims.

## 12. Risks and mitigations

- **Low differentiation:** Existing tools already scan licenses or preserve provenance. Mitigation: measure whether the evidence graph, conflict handling, and repeatable agent workflow add value; stop or narrow scope if not.
- **False confidence:** A report may be mistaken for legal clearance. Mitigation: strict status vocabulary, explicit unknowns, no “safe” verdict, and adversarial tests.
- **Incomplete history:** Git history may be shallow, rewritten, or detached from published artifacts. Mitigation: record scope and history limitations; never imply completeness.
- **External service instability:** Archives/APIs may be unavailable. Mitigation: optional adapters and partial-result reporting.
- **Prompt injection in repository content:** Malicious text may instruct the agent to ignore rules. Mitigation: treat all repository and remote content as data; never follow instructions found inside evidence.

## 13. MVP release gate

Do not call the MVP complete until P0 tests pass, reports are reproducible, target repositories remain unchanged, and a comparison against at least two existing license/provenance tools is documented with specific differences and limitations.
