/**
 * File discovery + AST loading for the i18n migrator.
 *
 * Uses the TypeScript compiler API directly (ts-morph was unavailable to
 * install in this environment; `typescript` is already a repository
 * devDependency and exposes the same underlying AST). The scanner's job is
 * strictly file discovery + parsing — it does not decide whether a string is
 * translatable; that is the classifier's job.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { IGNORED_DIR_PATTERNS, IGNORED_FILE_PATTERNS } from "./config";
import type { ParseFailure } from "./types";

export interface LoadedSourceFile {
  filePath: string;
  sourceFile: ts.SourceFile;
}

export interface DiscoveryResult {
  files: LoadedSourceFile[];
  parseFailures: ParseFailure[];
}

const SCANNABLE_EXTENSIONS = [".ts", ".tsx"];

function isIgnoredDir(dirName: string): boolean {
  return IGNORED_DIR_PATTERNS.some((pattern) => dirName === pattern);
}

function isIgnoredFile(fileName: string): boolean {
  return IGNORED_FILE_PATTERNS.some((pattern) => pattern.test(fileName));
}

/** Recursively collect .ts/.tsx file paths under a root, honoring ignore rules. */
export function discoverSourceFilePaths(rootPath: string): string[] {
  const absoluteRoot = path.resolve(rootPath);
  const stat = fs.statSync(absoluteRoot);

  if (stat.isFile()) {
    return SCANNABLE_EXTENSIONS.includes(path.extname(absoluteRoot)) ? [absoluteRoot] : [];
  }

  const results: string[] = [];
  const stack: string[] = [absoluteRoot];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) continue;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!isIgnoredDir(entry.name)) {
          stack.push(path.join(currentDir, entry.name));
        }
        continue;
      }

      if (!entry.isFile()) continue;
      if (!SCANNABLE_EXTENSIONS.includes(path.extname(entry.name))) continue;
      if (isIgnoredFile(entry.name)) continue;

      results.push(path.join(currentDir, entry.name));
    }
  }

  return results.sort();
}

/** Parse discovered files into ASTs, recording (not throwing on) parse failures. */
export function loadSourceFiles(filePaths: string[]): DiscoveryResult {
  const files: LoadedSourceFile[] = [];
  const parseFailures: ParseFailure[] = [];

  for (const filePath of filePaths) {
    try {
      const text = fs.readFileSync(filePath, "utf8");
      const scriptKind = filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
      const sourceFile = ts.createSourceFile(
        filePath,
        text,
        ts.ScriptTarget.ES2022,
        /* setParentNodes */ true,
        scriptKind,
      );
      files.push({ filePath, sourceFile });
    } catch (error) {
      parseFailures.push({
        filePath,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { files, parseFailures };
}

/** Discover and load all scannable source files under a target path. */
export function scanSourceFiles(targetPath: string): DiscoveryResult {
  const filePaths = discoverSourceFilePaths(targetPath);
  return loadSourceFiles(filePaths);
}
