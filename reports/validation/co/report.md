# LicenseTrace Investigation Report

**Run ID:** `run-1793132608105-37c2bd33`  
**Generated At:** `2026-10-27T20:23:28.105Z`  
**Tool Version:** `licensetrace v0.1.0`  
**Target Path:** `repos/co`  
**Target Revision:** `249bbdc72da24ae44076afd716349d2089b31c4c`  
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

- Evidence records generated: 7
- Material conflicts identified: 0
- Failed collections / errors: 0

### Collected Evidence Records

| Evidence ID | Kind | Source | Locator | Classification | Claim |
|---|---|---|---|---|---|
| **E-0001** | `license_file` | `LICENSE` | `L1-L23` | `direct` | License-like file found at 'LICENSE' (23 lines) |
| **E-0002** | `package_metadata` | `package.json` | `L1-L36` | `corroborating` | Package manifest 'package.json' declares license: MIT |
| **E-0003** | `readme_statement` | `Readme.md` | `L199-L213` | `corroborating` | README section '## License' found in 'Readme.md' |
| **E-0004** | `git_commit` | `4d2a63cad5788dd3fcdecfee7f2e43c19d0116ec` | `LICENSE` | `corroborating` | File 'LICENSE' first recorded in commit 4d2a63c by Jonathan Ong on 2014-10-27T21 |
| **E-0005** | `git_commit` | `4d2a63cad5788dd3fcdecfee7f2e43c19d0116ec` | `package.json` | `corroborating` | File 'package.json' first recorded in commit 4d2a63c by Jonathan Ong on 2014-10- |
| **E-0006** | `git_commit` | `4d2a63cad5788dd3fcdecfee7f2e43c19d0116ec` | `Readme.md` | `corroborating` | File 'Readme.md' first recorded in commit 4d2a63c by Jonathan Ong on 2014-10-27T |
| **E-0007** | `remote_metadata` | `https://github.com/tj/co.git` | `origin` | `context_only` | Configured Git remote 'origin': https://github.com/tj/co.git |

## 4. Evidence-Backed Findings

### [F-0001] Found 1 license-like file(s) in repository: LICENSE
- **Status:** `supported`
- **Supporting Evidence:** [E-0001](#collected-evidence-records)
- **Inference & Limitations:** Text was extracted from files matching standard license file names. The presence of a file does not constitute a legal determination of rights.

### [F-0002] Inspected package manifest declaration(s) in: package.json
- **Status:** `supported`
- **Supporting Evidence:** [E-0002](#collected-evidence-records)
- **Inference & Limitations:** Package manifest fields reflect declarations in package manager configurations and may differ from source code headers or repository licenses.

### [F-0003] Collected Git history records tracing addition/modification of license-relevant paths (3 record(s))
- **Status:** `supported`
- **Supporting Evidence:** [E-0004](#collected-evidence-records), [E-0005](#collected-evidence-records), [E-0006](#collected-evidence-records)
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
licensetrace "repos/co" --output-dir "reports/validation/co" --offline
```

## 8. Limitations and Non-Legal-Advice Notice

> **Important Notice:** LicenseTrace is an evidence organization and research tool, not a law firm or automated legal advisor. Findings in this report describe observed text, metadata, and version control records. They do not constitute legal advice, legal opinion, warranty of title, or a determination of non-infringement or permissibility. Use of software analyzed herein should be evaluated with qualified legal counsel.
