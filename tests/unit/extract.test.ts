import { describe, it, expect } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  isBinaryFile,
  readBoundedExcerpt,
  extractSourceHeader,
  extractPackageMetadata,
  extractReadmeLicenseStatement,
} from "../../scripts/extract.js";

describe("extract utility", () => {
  it("detects binary files with null bytes", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lt-bin-"));
    const textFile = path.join(tmpDir, "plain.txt");
    const binFile = path.join(tmpDir, "binary.dat");

    fs.writeFileSync(textFile, "Hello this is a plain text file", "utf-8");
    fs.writeFileSync(binFile, Buffer.from([0x00, 0x01, 0x02, 0xff]));

    expect(isBinaryFile(textFile)).toBe(false);
    expect(isBinaryFile(binFile)).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reads bounded excerpt with line counts and bounds max length", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lt-excerpt-"));
    const filePath = path.join(tmpDir, "lines.txt");

    const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}: Some content here`);
    fs.writeFileSync(filePath, lines.join("\n"), "utf-8");

    const excerpt = readBoundedExcerpt(filePath, 1, 10, 500);
    expect(excerpt.startLine).toBe(1);
    expect(excerpt.endLine).toBe(10);
    expect(excerpt.totalLines).toBe(100);
    expect(excerpt.truncated).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("extracts SPDX and copyright headers from source files", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lt-header-"));
    const tsFile = path.join(tmpDir, "index.ts");

    fs.writeFileSync(
      tsFile,
      `// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Acme Corp
// All rights reserved.

export function hello() {
  return "world";
}
`,
      "utf-8"
    );

    const extracted = extractSourceHeader(tsFile);
    expect(extracted).not.toBeNull();
    expect(extracted?.hasHeader).toBe(true);
    expect(extracted?.spdxId).toBe("Apache-2.0");
    expect(extracted?.copyrightNotice).toContain("Copyright 2026 Acme Corp");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("extracts license metadata from package.json", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lt-pkg-"));
    const pkgPath = path.join(tmpDir, "package.json");

    fs.writeFileSync(
      pkgPath,
      JSON.stringify(
        {
          name: "demo",
          version: "1.0.0",
          license: "MIT",
          author: "Jane Doe <jane@example.com>",
        },
        null,
        2
      ),
      "utf-8"
    );

    const meta = extractPackageMetadata(pkgPath);
    expect(meta).not.toBeNull();
    expect(meta?.format).toBe("npm");
    expect(meta?.declaredLicense).toBe("MIT");
    expect(meta?.authors).toContain("Jane Doe <jane@example.com>");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("extracts license statements from README.md", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lt-readme-"));
    const readmePath = path.join(tmpDir, "README.md");

    fs.writeFileSync(
      readmePath,
      `# Project Title

A cool project.

## Installation
Run bun install.

## License
This project is licensed under the MIT License. See LICENSE for details.
`,
      "utf-8"
    );

    const extracted = extractReadmeLicenseStatement(readmePath);
    expect(extracted).not.toBeNull();
    expect(extracted?.hasLicenseSection).toBe(true);
    expect(extracted?.sectionHeading).toBe("## License");
    expect(extracted?.excerpt.text).toContain("MIT License");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
