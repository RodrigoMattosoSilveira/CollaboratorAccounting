/**
 * Validates that a proposed transformed snippet is syntactically valid
 * TypeScript/TSX by re-parsing it, per Phase 2A requirement #15. This never
 * writes anything — it is used to decide whether a planned change is safe
 * to keep in the dry-run output (and, later, safe to apply).
 */
import ts from "typescript";

export interface ValidationResult {
  valid: boolean;
  diagnostics: string[];
}

/**
 * Parse `fullFileText` as a .tsx (or .ts) file and check for syntax errors
 * (parse-level diagnostics only — this is not a full type-check, which would
 * require a full program/compiler host and is unnecessary for validating
 * that a textual AST transformation did not corrupt the syntax).
 */
export function validateSourceText(fileName: string, fullFileText: string): ValidationResult {
  const scriptKind = fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(fileName, fullFileText, ts.ScriptTarget.ES2022, false, scriptKind);

  const diagnostics: string[] = [];
  const parseDiagnostics = (sourceFile as unknown as { parseDiagnostics?: ts.DiagnosticWithLocation[] }).parseDiagnostics;
  if (parseDiagnostics) {
    for (const diagnostic of parseDiagnostics) {
      diagnostics.push(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
    }
  }

  return { valid: diagnostics.length === 0, diagnostics };
}
