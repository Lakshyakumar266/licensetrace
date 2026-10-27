# LicenseTrace — Implementation Plan

## Guiding approach

Build an evidence collector and report generator first. Add the agent skill after the underlying facts are deterministic. This avoids making the language model responsible for discovering paths, calculating hashes, reconstructing commit history, or validating output. Network/provenance integrations are P1 and should not delay a sound offline MVP.

## Proposed architecture

```text
User / coding agent
       |
       v
SKILL.md workflow ----> CLI invocation and reporting rules
       |
       v
CLI (argument parsing, options, exit codes)
       |
       +--> filesystem inventory
       +--> bounded text/header extractor
       +--> Git metadata/history collector
       +--> optional artifact hash comparator (P1)
       +--> optional remote/archive adapters (P1, opt-in)
       |
       v
Evidence normalizer + schema validation
       |
       +--> evidence.json
       +--> manifest.json
       +--> report.md
```

## Suggested repository structure

```text
licensetrace/
├── SKILL.md
├── README.md
├── PRD.md
├── TEST_PLAN.md
├── IMPLEMENTATION_PLAN.md
├── WORKFLOW.md
├── package.json
├── tsconfig.json
├── src/
│   ├── cli.ts
│   ├── schema.ts
│   ├── inventory.ts
│   ├── extract.ts
│   ├── git.ts
│   ├── manifest.ts
│   ├── report.ts
│   └── util/
│       ├── process.ts
│       ├── paths.ts
│       └── hash.ts
├── references/
│   ├── evidence-schema.md
│   └── reporting-rules.md
└── tests/
    ├── unit/
    ├── integration/
    └── fixtures/
        ├── clear-license/
        ├── missing-license/
        ├── conflicting-license/
        ├── license-added-later/
        ├── license-removed/
        ├── shallow-history/
        └── prompt-injection-content/
```

This is a target layout, not a claim that files already exist. Adjust only when the actual repository structure requires it.

## Milestones

### M0 — Validate the problem and prior art

**Tasks**
- Compare the intended workflow against at least two existing license scanners and one provenance/archive service.
- Record supported input types, outputs, traceability, conflict handling, and limitations in `docs/PRIOR_ART.md` or README.
- Test whether an ordinary coding agent plus existing tools can already produce the same result with similar reliability.

**Exit gate**
- A specific user-visible gap is demonstrated. If no gap is demonstrated, narrow the project to a reproducible evaluation/benchmark or stop before implementation expands.

### M1 — Contract and schema

**Tasks**
- Define enums for evidence kind, classification, report status, and collection outcome.
- Define `EvidenceRecord`, `Finding`, and `RunManifest` TypeScript types and runtime validation.
- Add example JSON fixtures and schema documentation.

**Exit gate**
- Invalid evidence records fail validation; every finding can reference existing evidence IDs only.

### M2 — Offline filesystem inventory

**Tasks**
- Detect repository root and inventory relevant filenames and metadata.
- Extract bounded excerpts with line numbers from candidate text files.
- Skip binary files and enforce file-size limits.
- Do not interpret a filename alone as proof of a license.

**Exit gate**
- Unit tests cover case-insensitive filenames, large/binary files, path spaces, and missing files.

### M3 — Git history collector

**Tasks**
- Capture target revision, remotes, branches/tags summary, and relevant path history.
- Capture commit hashes, author/commit dates as exposed by Git, and subject lines with safe output bounds.
- Record shallow-history indicators and failed/unavailable commands.
- Do not fetch remote content in default mode.

**Exit gate**
- History fixtures match expected commits; shallow/incomplete history is clearly disclosed.

### M4 — Report generation and safety

**Tasks**
- Generate `evidence.json`, `manifest.json`, and `report.md`.
- Add evidence ID cross-reference validation.
- Implement conservative status derivation and explicit contradiction sections.
- Verify the target working tree is not modified.

**Exit gate**
- P0 integration tests pass; no permission/safety verdicts can be emitted.

### M5 — Agent skill integration

**Tasks**
- Write `SKILL.md` with triggers, prerequisites, commands, workflow, and failure handling.
- Require the agent to summarize only collected evidence and cite IDs.
- Add adversarial fixture for instructions embedded in source/README/commit messages.
- Verify the skill can be used without Pi-specific APIs; Pi package support is added as packaging metadata only if needed.

**Exit gate**
- Agent evaluation passes the rubric in `TEST_PLAN.md`, especially calibration and instruction isolation.

### M6 — Optional P1 integrations

**Tasks**
- Add explicit `--network` or equivalent opt-in.
- Implement selected upstream/release/archive/provenance adapters one at a time.
- Store URLs, timestamps, retrieval failures, and content hashes where possible.
- Keep adapters independently testable and gracefully degradable.

**Exit gate**
- Each adapter has mocked tests and documented rate limits/failure behavior. No network integration runs by default.

### M7 — Release and challenge submission

**Tasks**
- Run tests on Windows and a POSIX environment.
- Review docs for unsupported novelty or legal claims.
- Record a short demo using a synthetic fixture, not a repository whose licensing is uncertain.
- Publish limitations and a clear prior-art comparison.

**Exit gate**
- All P0 requirements pass, install/use instructions work from a clean checkout, and demo output is reproducible.

## Risk-first sequencing

The largest risk is not implementation difficulty; it is weak differentiation. Complete M0 before investing in remote adapters or elaborate packaging. The smallest defensible MVP is a deterministic local evidence bundle plus an agent workflow that handles ambiguity better than a generic prompt. If tests cannot demonstrate that advantage, do not inflate the feature set to disguise it.

## Engineering conventions

- TypeScript + Bun for the initial toolchain.
- Git CLI as the source of Git facts; call subprocesses with argument arrays, never concatenate untrusted paths into shell strings.
- No execution of repository scripts.
- Runtime validation at input/output boundaries.
- Bounded excerpts and outputs.
- Unit tests for pure functions; temporary repositories for integration tests.
- CI should run install, tests, lint, typecheck, and a CLI smoke test.
