# LicenseTrace Investigation Report

**Run ID:** `run-1793132597604-a6294ca1`  
**Generated At:** `2026-10-27T20:23:17.604Z`  
**Tool Version:** `licensetrace v0.1.0`  
**Target Path:** `repos/p-limit`  
**Target Revision:** `a8a6fbec4e0e866d6d779b10889bb4f5567e70eb`  
**Shallow History:** ⚠️ Yes (truncated history)

## 1. Investigation Question and Scope

**Question:** Audit repository licensing and attribution evidence

- **Execution Mode:** Offline (local filesystem and Git only)
- **History Analyzed:** Yes
- **Max Commits Inspected:** 50
- **Max File Size:** 1048576 bytes

## 2. Summary Status

**Status:** `supported`

> ✅ **Supported Findings:** Observed license and attribution evidence directly corroborates the factual findings listed below. This report is an evidence summary, not legal clearance.

## 3. What Was Observed

- Evidence records generated: 6
- Material conflicts identified: 0
- Failed collections / errors: 0

### Collected Evidence Records

| Evidence ID | Kind | Source | Locator | Classification | Claim |
|---|---|---|---|---|---|
| **E-0001** | `license_file` | `license` | `L1-L10` | `direct` | License-like file found at 'license' (10 lines) |
| **E-0002** | `package_metadata` | `package.json` | `L1-L59` | `corroborating` | Package manifest 'package.json' declares license: MIT |
| **E-0003** | `git_commit` | `0038c559658ad75445de4b3a8c6e0167129e813c` | `license` | `corroborating` | File 'license' first recorded in commit 0038c55 by Sindre Sorhus on 2020-06-06T1 |
| **E-0004** | `git_commit` | `0038c559658ad75445de4b3a8c6e0167129e813c` | `package.json` | `corroborating` | File 'package.json' first recorded in commit 0038c55 by Sindre Sorhus on 2020-06 |
| **E-0005** | `git_commit` | `0038c559658ad75445de4b3a8c6e0167129e813c` | `readme.md` | `corroborating` | File 'readme.md' first recorded in commit 0038c55 by Sindre Sorhus on 2020-06-06 |
| **E-0006** | `remote_metadata` | `https://github.com/sindresorhus/p-limit.git` | `origin` | `context_only` | Configured Git remote 'origin': https://github.com/sindresorhus/p-limit.git |

## 4. Evidence-Backed Findings

### [F-0001] Found 1 license-like file(s) in repository: license
- **Status:** `supported`
- **Supporting Evidence:** [E-0001](#collected-evidence-records)
- **Inference & Limitations:** Text was extracted from files matching standard license file names. The presence of a file does not constitute a legal determination of rights.

### [F-0002] Inspected package manifest declaration(s) in: package.json
- **Status:** `supported`
- **Supporting Evidence:** [E-0002](#collected-evidence-records)
- **Inference & Limitations:** Package manifest fields reflect declarations in package manager configurations and may differ from source code headers or repository licenses.

### [F-0003] Collected Git history records tracing addition/modification of license-relevant paths (3 record(s))
- **Status:** `supported`
- **Supporting Evidence:** [E-0003](#collected-evidence-records), [E-0004](#collected-evidence-records), [E-0005](#collected-evidence-records)
- **Inference & Limitations:** Git commit logs reflect recorded commit history in this clone. Commits could have been amended, rebased, or truncated if history is shallow.

## 5. Conflicting Evidence

No material conflicts between licensing signals were detected in the inspected scope.

## 6. What Remains Unknown

- Git history is shallow; older commits prior to clone depth were not inspected.
- Offline mode: external remotes, upstream repositories, package registries, and archival services were not queried.
- Unreviewed third-party dependencies outside repository source tree are not audited.
- Legal validity, copyright chain of title, and enforceability under applicable jurisdiction remain unverified.

## 7. Reproduction Steps

To reproduce this exact collection and audit independently, execute:
```bash
licensetrace "repos/p-limit" --output-dir "reports/validation/p-limit" --offline
```

## 8. Limitations and Non-Legal-Advice Notice

> **Important Notice:** LicenseTrace is an evidence organization and research tool, not a law firm or automated legal advisor. Findings in this report describe observed text, metadata, and version control records. They do not constitute legal advice, legal opinion, warranty of title, or a determination of non-infringement or permissibility. Use of software analyzed herein should be evaluated with qualified legal counsel.
