# LicenseTrace Real-Repository Validation Summary

**Date of Execution:** 2026-10-27 / 2026-10-28  
**Tool Under Test:** `licensetrace v0.1.0` (zero-dependency standalone Agent Skill)  
**Execution Runtime:** Bun v1.3.14 on Windows 11 x64  
**Git Version:** `git version 2.48.1.windows.1`  
**Automated Test Suite Status:** 29 tests passing across 6 test suites (0 failures)

---

## 1. Test Environment Specification

| Component | Specification |
|---|---|
| **OS** | Windows 11 Pro 64-bit |
| **Shell** | PowerShell 5.1 / Bun Shell |
| **Node / Bun Engine** | Bun v1.3.14 (`bun run` / `bun test`) |
| **Git Binary** | Git 2.48.1.windows.1 |
| **Execution Mode** | Strictly local / offline (`--offline`), read-only filesystem |
| **Dependencies** | Zero external runtime dependencies (`dependencies: {}`) |

---

## 2. Tested Real Repositories and Exact Revisions

| Repository | Canonical Upstream URL | Tested Commit SHA | Rationale for Selection | Investigation Status |
|---|---|---|---|---|
| **`sindresorhus/p-limit`** | `https://github.com/sindresorhus/p-limit.git` | `a8a6fbec4e0e866d6d779b10889bb4f5567e70eb` | Ubiquitous Node.js concurrency utility. Canonical modern open-source repo with root `license` file, `package.json`, and single-author baseline. | `supported` |
| **`tj/co`** | `https://github.com/tj/co.git` | `249bbdc72da24ae44076afd716349d2089b31c4c` | Historic generator-based async flow library (2013-2015). Multi-contributor Git history, `Readme.md` license section, and commit attribution transitions. | `supported` |
| **`Rich-Harris/devalue`** | `https://github.com/Rich-Harris/devalue.git` | `b0b7a4ccd30b9902e8653babe4269fa002505c2a` | High-profile serialization library by Svelte creator. Rich multi-contributor commit tree with root `LICENSE`, `README.md` license clause, and test sub-readmes. | `supported` |

---

## 3. Reproducible Audit Commands and Results

### Repository 1: `sindresorhus/p-limit`
```bash
bun scripts/licensetrace.ts \
  "repos/p-limit" \
  --output-dir reports/validation/p-limit
```
- **Exit Status:** `0` (Success)
- **Execution Time:** ~420ms
- **Evidence Count:** 6 records generated
- **Findings:**
  - Direct root license: `license` (10 lines)
  - Package manifest declaration: `package.json` declares `"license": "MIT"`
  - Git history records: Traced `license`, `package.json`, and `readme.md` to initial recorded commits
  - Truncated history detection: Correctly flagged `shallow_history: true`
- **Output Artifacts:**
  - Markdown Report: [`reports/validation/p-limit/report.md`](reports/validation/p-limit/report.md)
  - JSON Evidence: [`reports/validation/p-limit/evidence.json`](reports/validation/p-limit/evidence.json)
  - Manifest: [`reports/validation/p-limit/manifest.json`](reports/validation/p-limit/manifest.json)

---

### Repository 2: `tj/co`
```bash
bun scripts/licensetrace.ts \
  "repos/co" \
  --output-dir reports/validation/co
```
- **Exit Status:** `0` (Success)
- **Execution Time:** ~390ms
- **Evidence Count:** 7 records generated
- **Findings:**
  - Direct root license: `LICENSE` (23 lines)
  - Package manifest declaration: `package.json` declares `"license": "MIT"`
  - README License section: Successfully extracted `Readme.md` section `## License` (L199-L213)
  - Git history records: Traced `LICENSE`, `package.json`, and `Readme.md` commits
  - Truncated history detection: Correctly flagged `shallow_history: true`
- **Output Artifacts:**
  - Markdown Report: [`reports/validation/co/report.md`](reports/validation/co/report.md)
  - JSON Evidence: [`reports/validation/co/evidence.json`](reports/validation/co/evidence.json)
  - Manifest: [`reports/validation/co/manifest.json`](reports/validation/co/manifest.json)

---

### Repository 3: `Rich-Harris/devalue`
```bash
bun scripts/licensetrace.ts \
  "repos/devalue" \
  --output-dir reports/validation/devalue
```
- **Exit Status:** `0` (Success)
- **Execution Time:** ~440ms
- **Evidence Count:** 8 records generated
- **Findings:**
  - Direct root license: `LICENSE` (8 lines, MIT)
  - Package manifest declaration: `package.json` declares `"license": "MIT"`
  - README License section: `README.md` lines 342-345 (`## License`)
  - Sub-directory README notice: Captured historical notice in `test/README.md`
  - Git history records: Traced commits by multiple contributors (Gabriel Stellini, Elliott Johnson)
  - Truncated history detection: Correctly flagged `shallow_history: true`
- **Output Artifacts:**
  - Markdown Report: [`reports/validation/devalue/report.md`](reports/validation/devalue/report.md)
  - JSON Evidence: [`reports/validation/devalue/evidence.json`](reports/validation/devalue/evidence.json)
  - Manifest: [`reports/validation/devalue/manifest.json`](reports/validation/devalue/manifest.json)

---

## 4. Independent Verification Checklist

| Verification Item | Result | Independent Verification Method |
|---|---|---|
| **Root License File Existence** | Verified | Inspected raw repository files on disk; file lengths and content match locators. |
| **SHA-256 Content Hashes** | Verified | Computed standalone SHA-256 via OpenSSL / Bun crypto; matched `evidence.json` hashes. |
| **Commit Hashes in Git History** | Verified | Checked via `git log -1 <hash>` in the local clones; commits and author names exist. |
| **Read-Only Invariant** | Verified | Ran `git status` on target repos before and after audit; zero modified or untracked files. |
| **Shallow Clone Detection** | Verified | Checked `.git/shallow`; LicenseTrace flagged `shallow_history: true` in all 3 runs. |
| **Exit Codes & Schema Validity** | Verified | All JSON evidence conforms to `EvidenceBundle` schema; validator returned 0 errors. |

---

## 5. What the Evidence Demonstrates vs. Does Not Demonstrate

### What It Demonstrates:
1. **Accurate Signal Extraction:** LicenseTrace deterministically extracts root license texts, package manifest SPDX declarations, README license headers, and version control commits.
2. **Deterministic Correlation:** Multiple indicators pointing to the same license (e.g. root MIT + package.json MIT) are classified as `supported` without hallucinations.
3. **Traceability:** Every finding explicitly cites a locator (file path, line range, or commit hash) and a content hash.
4. **Safety & Zero Footprint:** The tool runs in under 500ms per repo, never mutates the inspected repository, and makes zero network calls.

### What It Does NOT Demonstrate:
1. **Not Legal Advice:** LicenseTrace does not determine legal enforceability, patent grant validity, or commercial permissibility under specific jurisdictions.
2. **Third-Party Dependency Audit:** Sub-dependencies inside `node_modules` were not traversed in this phase.
3. **Deep Git Archaeology in Shallow Clones:** Truncated histories (`--depth 50`) prevent finding commits prior to the clone depth; LicenseTrace explicitly documents this unknown rather than guessing.
