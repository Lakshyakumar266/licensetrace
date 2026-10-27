import { describe, it, expect } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { hashString, hashFile, compareFilesByHash } from "../../scripts/util/hash.js";

describe("hash utility", () => {
  it("computes reproducible sha256 hash of string content", () => {
    const res1 = hashString("hello world\n");
    const res2 = hashString("hello world\n");
    expect(res1.algorithm).toBe("sha256");
    expect(res1.digest).toBe(res2.digest);
    expect(res1.digest.length).toBe(64);
  });

  it("produces different hashes for different contents", () => {
    const res1 = hashString("MIT License");
    const res2 = hashString("Apache License");
    expect(res1.digest).not.toBe(res2.digest);
  });

  it("hashes files on disk correctly", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lt-hash-"));
    const filePath = path.join(tmpDir, "test.txt");
    fs.writeFileSync(filePath, "test content for hashing", "utf-8");

    const fileHash = hashFile(filePath);
    const strHash = hashString("test content for hashing");

    expect(fileHash.digest).toBe(strHash.digest);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("compares two files for identical, different, or missing", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lt-comp-"));
    const file1 = path.join(tmpDir, "file1.txt");
    const file2 = path.join(tmpDir, "file2.txt");
    const file3 = path.join(tmpDir, "file3.txt");

    fs.writeFileSync(file1, "sample text A", "utf-8");
    fs.writeFileSync(file2, "sample text A", "utf-8");
    fs.writeFileSync(file3, "sample text B", "utf-8");

    const compIdentical = compareFilesByHash(file1, file2);
    expect(compIdentical.outcome).toBe("identical");

    const compDiff = compareFilesByHash(file1, file3);
    expect(compDiff.outcome).toBe("different");

    const compMissing = compareFilesByHash(file1, path.join(tmpDir, "nonexistent.txt"));
    expect(compMissing.outcome).toBe("not_comparable");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
