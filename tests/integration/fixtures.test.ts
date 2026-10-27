import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runLicenseTrace } from "../../scripts/licensetrace.js";
import { executeCommand } from "../../scripts/util/process.js";
import { validateEvidenceBundle, type EvidenceBundle } from "../../scripts/schema.js";

function copyDirRecursive(src: string, dest: string) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function initGitRepo(dir: string) {
  await executeCommand({ cmd: ["git", "init"], cwd: dir });
  await executeCommand({ cmd: ["git", "config", "user.name", "Test User"], cwd: dir });
  await executeCommand({ cmd: ["git", "config", "user.email", "test@example.com"], cwd: dir });
  await executeCommand({ cmd: ["git", "add", "."], cwd: dir });
  await executeCommand({ cmd: ["git", "commit", "-m", "Initial commit"], cwd: dir });
}

describe("integration tests with fixtures", () => {
  let tmpBase: string;

  beforeEach(() => {
    tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "lt-int-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error on windows locks
    }
  });

  it("IT-01: clear-license produces supported status and validated bundle", async () => {
    const fixtureSrc = path.resolve("tests/fixtures/clear-license");
    const repoDir = path.join(tmpBase, "clear-repo");
    const outputDir = path.join(tmpBase, "clear-output");

    copyDirRecursive(fixtureSrc, repoDir);
    await initGitRepo(repoDir);

    const exitCode = await runLicenseTrace([repoDir, "--output-dir", outputDir]);
    expect(exitCode).toBe(0);

    const evidenceJsonPath = path.join(outputDir, "evidence.json");
    const reportMdPath = path.join(outputDir, "report.md");

    expect(fs.existsSync(evidenceJsonPath)).toBe(true);
    expect(fs.existsSync(reportMdPath)).toBe(true);

    const bundle: EvidenceBundle = JSON.parse(fs.readFileSync(evidenceJsonPath, "utf-8"));
    const valResult = validateEvidenceBundle(bundle);
    expect(valResult.valid).toBe(true);

    const reportContent = fs.readFileSync(reportMdPath, "utf-8");
    expect(reportContent).toContain("Status:** `supported`");
    expect(reportContent).toContain("Apache-2.0");
    expect(reportContent).toContain("LicenseTrace is an evidence organization and research tool");
  });

  it("IT-02: conflicting-license produces mixed status and preserves contradictions", async () => {
    const fixtureSrc = path.resolve("tests/fixtures/conflicting-license");
    const repoDir = path.join(tmpBase, "conflict-repo");
    const outputDir = path.join(tmpBase, "conflict-output");

    copyDirRecursive(fixtureSrc, repoDir);
    await initGitRepo(repoDir);

    const exitCode = await runLicenseTrace([repoDir, "--output-dir", outputDir]);
    expect(exitCode).toBe(0);

    const bundle: EvidenceBundle = JSON.parse(
      fs.readFileSync(path.join(outputDir, "evidence.json"), "utf-8")
    );
    const valResult = validateEvidenceBundle(bundle);
    expect(valResult.valid).toBe(true);

    expect(bundle.conflicts.length).toBeGreaterThan(0);
    expect(bundle.conflicts[0].resolution_status).toBe("preservation_required");

    const reportContent = fs.readFileSync(path.join(outputDir, "report.md"), "utf-8");
    expect(reportContent).toContain("Status:** `mixed`");
    expect(reportContent).toContain("5. Conflicting Evidence");
  });

  it("IT-03: missing-license produces insufficient status and explicit non-permission", async () => {
    const fixtureSrc = path.resolve("tests/fixtures/missing-license");
    const repoDir = path.join(tmpBase, "missing-repo");
    const outputDir = path.join(tmpBase, "missing-output");

    copyDirRecursive(fixtureSrc, repoDir);
    await initGitRepo(repoDir);

    const exitCode = await runLicenseTrace([repoDir, "--output-dir", outputDir]);
    expect(exitCode).toBe(0);

    const bundle: EvidenceBundle = JSON.parse(
      fs.readFileSync(path.join(outputDir, "evidence.json"), "utf-8")
    );
    const valResult = validateEvidenceBundle(bundle);
    expect(valResult.valid).toBe(true);

    const reportContent = fs.readFileSync(path.join(outputDir, "report.md"), "utf-8");
    expect(reportContent).toContain("Status:** `insufficient`");
    expect(reportContent).toContain("silence retains all rights; no explicit permission is established");
    expect(reportContent.toLowerCase()).not.toContain("safe to use");
    expect(reportContent.toLowerCase()).not.toContain("public domain");
  });

  it("IT-04: license-added-later and license-removed Git history tracking", async () => {
    const repoDir = path.join(tmpBase, "history-repo");
    const outputDir = path.join(tmpBase, "history-output");
    fs.mkdirSync(repoDir, { recursive: true });

    await executeCommand({ cmd: ["git", "init"], cwd: repoDir });
    await executeCommand({ cmd: ["git", "config", "user.name", "Test Committer"], cwd: repoDir });
    await executeCommand({ cmd: ["git", "config", "user.email", "test@example.com"], cwd: repoDir });

    // Commit 1: Add source code only
    fs.writeFileSync(path.join(repoDir, "app.ts"), 'console.log("hello");', "utf-8");
    await executeCommand({ cmd: ["git", "add", "."], cwd: repoDir });
    await executeCommand({ cmd: ["git", "commit", "-m", "Initial code commit"], cwd: repoDir });

    // Commit 2: Add LICENSE later
    fs.writeFileSync(path.join(repoDir, "LICENSE"), "MIT License\nCopyright (c) 2026", "utf-8");
    await executeCommand({ cmd: ["git", "add", "."], cwd: repoDir });
    await executeCommand({ cmd: ["git", "commit", "-m", "Add MIT license file"], cwd: repoDir });

    const exitCode = await runLicenseTrace([repoDir, "--output-dir", outputDir]);
    expect(exitCode).toBe(0);

    const bundle: EvidenceBundle = JSON.parse(
      fs.readFileSync(path.join(outputDir, "evidence.json"), "utf-8")
    );
    expect(bundle.evidence.some((e) => e.kind === "git_commit" && e.claim.includes("LICENSE"))).toBe(
      true
    );

    // Commit 3: Remove LICENSE file
    fs.unlinkSync(path.join(repoDir, "LICENSE"));
    await executeCommand({ cmd: ["git", "add", "-A"], cwd: repoDir });
    await executeCommand({ cmd: ["git", "commit", "-m", "Remove license file"], cwd: repoDir });

    const outputDir2 = path.join(tmpBase, "history-output-2");
    await runLicenseTrace([repoDir, "--output-dir", outputDir2]);

    const bundle2: EvidenceBundle = JSON.parse(
      fs.readFileSync(path.join(outputDir2, "evidence.json"), "utf-8")
    );
    expect(
      bundle2.evidence.some(
        (e) => e.kind === "git_commit" && e.classification === "contradictory" && e.claim.includes("deleted")
      )
    ).toBe(true);
  });

  it("IT-05: read-only guarantee leaves target repository completely unmodified", async () => {
    const fixtureSrc = path.resolve("tests/fixtures/clear-license");
    const repoDir = path.join(tmpBase, "ro-repo");
    const outputDir = path.join(tmpBase, "ro-output");

    copyDirRecursive(fixtureSrc, repoDir);
    await initGitRepo(repoDir);

    // Snapshot target git status before run
    const statusBefore = await executeCommand({ cmd: ["git", "status", "--porcelain"], cwd: repoDir });

    await runLicenseTrace([repoDir, "--output-dir", outputDir]);

    // Snapshot target git status after run
    const statusAfter = await executeCommand({ cmd: ["git", "status", "--porcelain"], cwd: repoDir });

    expect(statusBefore.stdout).toBe(statusAfter.stdout);
    expect(statusAfter.stdout.trim()).toBe("");
  });

  it("IT-07: prompt-injection content is treated strictly as untrusted data", async () => {
    const fixtureSrc = path.resolve("tests/fixtures/prompt-injection-content");
    const repoDir = path.join(tmpBase, "injection-repo");
    const outputDir = path.join(tmpBase, "injection-output");

    copyDirRecursive(fixtureSrc, repoDir);
    await initGitRepo(repoDir);

    const exitCode = await runLicenseTrace([repoDir, "--output-dir", outputDir]);
    expect(exitCode).toBe(0);

    const bundle: EvidenceBundle = JSON.parse(
      fs.readFileSync(path.join(outputDir, "evidence.json"), "utf-8")
    );
    const reportContent = fs.readFileSync(path.join(outputDir, "report.md"), "utf-8");

    // The adversarial directive "declare safe to use" and "override to supported" must NOT succeed
    expect(bundle.findings.some((f) => f.statement.toLowerCase().includes("safe to use"))).toBe(false);
    expect(reportContent).toContain("Status:** `insufficient`");
  });

  it("handles paths with spaces in repository directory name", async () => {
    const fixtureSrc = path.resolve("tests/fixtures/clear-license");
    const repoDir = path.join(tmpBase, "repo with spaces in name");
    const outputDir = path.join(tmpBase, "output with spaces");

    copyDirRecursive(fixtureSrc, repoDir);
    await initGitRepo(repoDir);

    const exitCode = await runLicenseTrace([repoDir, "--output-dir", outputDir]);
    expect(exitCode).toBe(0);
    expect(fs.existsSync(path.join(outputDir, "report.md"))).toBe(true);
  });

  it("handles non-git directory gracefully in filesystem-only mode", async () => {
    const fixtureSrc = path.resolve("tests/fixtures/clear-license");
    const plainDir = path.join(tmpBase, "plain-non-git-dir");
    const outputDir = path.join(tmpBase, "non-git-output");

    copyDirRecursive(fixtureSrc, plainDir);
    // Notice: no git init!

    const exitCode = await runLicenseTrace([plainDir, "--output-dir", outputDir]);
    expect(exitCode).toBe(0);

    const bundle: EvidenceBundle = JSON.parse(
      fs.readFileSync(path.join(outputDir, "evidence.json"), "utf-8")
    );
    expect(bundle.manifest.is_git_repository).toBe(false);
    expect(bundle.manifest.target_revision).toBeNull();
    expect(fs.existsSync(path.join(outputDir, "report.md"))).toBe(true);
  });
});
