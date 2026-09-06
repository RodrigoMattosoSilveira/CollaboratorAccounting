/**
 * Shared types for the Phase 1 i18n migrator (read-only audit/scanner).
 */

/** Classification bucket assigned to a detected candidate string. */
export type Classification = "SAFE_AUTO" | "SPECIAL_HANDLING" | "MANUAL_REVIEW";

/** The syntactic/semantic context in which a candidate string was found. */
export type FindingCategory =
  | "JSX_TEXT"
  | "JSX_ATTRIBUTE"
  | "TEMPLATE_LITERAL"
  | "OBJECT_PROPERTY"
  | "CONDITIONAL_STRING"
  | "FUNCTION_RETURN_STRING"
  | "MESSAGE_SETTER_ARGUMENT";

/** A single classified candidate (or informational) result from the scan. */
export interface Finding {
  filePath: string;
  line: number;
  text: string;
  category: FindingCategory;
  classification: Classification;
  reason: string;
  /** JSX tag name, prop name, or object property name, when applicable. */
  context?: string;
}

/** A string that was structurally excluded as "technical" rather than UI text. */
export interface ExcludedString {
  filePath: string;
  line: number;
  text: string;
  reason: string;
}

/** A file that failed to parse; recorded rather than aborting the whole scan. */
export interface ParseFailure {
  filePath: string;
  message: string;
}

/** Aggregated result of scanning one or more files. */
export interface ScanResult {
  filesScanned: number;
  findings: Finding[];
  excluded: ExcludedString[];
  parseFailures: ParseFailure[];
}
