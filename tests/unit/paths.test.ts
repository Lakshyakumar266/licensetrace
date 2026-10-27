import { describe, it, expect } from "bun:test";
import {
  isLicenseFilename,
  isPackageManifestFilename,
  isReadmeFilename,
  normalizePath,
  isPathInside,
} from "../../scripts/util/paths.js";

describe("paths utility", () => {
  it("normalizes backslashes to forward slashes", () => {
    expect(normalizePath("foo\\bar\\baz.ts")).toBe("foo/bar/baz.ts");
    expect(normalizePath("C:\\repo\\file.txt")).toBe("C:/repo/file.txt");
  });

  it("identifies license-like filenames case-insensitively", () => {
    const valid = [
      "LICENSE",
      "license",
      "License",
      "LICENSE.md",
      "LICENSE.txt",
      "LICENCE",
      "COPYING",
      "COPYING.txt",
      "COPYRIGHT",
      "NOTICE",
      "NOTICE.md",
      "UNLICENSE",
      "AUTHORS",
      "CONTRIBUTORS",
    ];

    for (const name of valid) {
      expect(isLicenseFilename(name)).toBe(true);
    }

    const invalid = ["license_utils.ts", "package.json", "index.ts", "README.md"];
    for (const name of invalid) {
      expect(isLicenseFilename(name)).toBe(false);
    }
  });

  it("identifies package manifests correctly", () => {
    expect(isPackageManifestFilename("package.json")).toBe(true);
    expect(isPackageManifestFilename("Cargo.toml")).toBe(true);
    expect(isPackageManifestFilename("pyproject.toml")).toBe(true);
    expect(isPackageManifestFilename("setup.py")).toBe(true);
    expect(isPackageManifestFilename("pom.xml")).toBe(true);
    expect(isPackageManifestFilename("go.mod")).toBe(true);
    expect(isPackageManifestFilename("foo.gemspec")).toBe(true);
    expect(isPackageManifestFilename("random.json")).toBe(false);
  });

  it("identifies readme files correctly", () => {
    expect(isReadmeFilename("README.md")).toBe(true);
    expect(isReadmeFilename("readme.txt")).toBe(true);
    expect(isReadmeFilename("README")).toBe(true);
    expect(isReadmeFilename("README.rst")).toBe(true);
    expect(isReadmeFilename("readme_test.py")).toBe(false);
  });

  it("checks whether a path is inside another directory", () => {
    expect(isPathInside("/repo", "/repo/.licensetrace")).toBe(true);
    expect(isPathInside("/repo", "/outside/path")).toBe(false);
  });
});
