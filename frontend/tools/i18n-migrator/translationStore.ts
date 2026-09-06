/**
 * Read-only translation planning store for Phase 2A.
 *
 * Inspects existing locale JSON (en/<namespace>.json, pt-BR/<namespace>.json)
 * to detect already-present keys, collisions, and reused English values.
 * Never writes files in this phase.
 */
import fs from "node:fs";
import path from "node:path";

export interface LocaleSnapshot {
  namespace: string;
  /** Absolute path to en/<namespace>.json, whether or not it currently exists. */
  enPath: string;
  /** Absolute path to pt-BR/<namespace>.json, whether or not it currently exists. */
  ptBrPath: string;
  enExists: boolean;
  ptBrExists: boolean;
  /** Flat map of dotted-path -> English value, for existing flat or nested namespaces. */
  enEntries: Record<string, string>;
  ptBrEntries: Record<string, string>;
  /** Whether the existing namespace file (if any) uses nested objects rather than flat keys. */
  isNested: boolean;
}

export interface PlannedEntry {
  namespace: string;
  key: string;
  englishValue: string;
  sourceFile: string;
  sourceLine: number;
  classification: "SAFE_AUTO";
  /** True if an identical key already exists in en/<namespace>.json with the same value (reuse, not a new entry). */
  reusedExisting: boolean;
  /** True if the proposed key already exists in en/<namespace>.json with a DIFFERENT value (collision — do not overwrite). */
  collision: boolean;
}

function flattenEntries(value: unknown, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof value === "string") {
    out[prefix] = value;
    return out;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      Object.assign(out, flattenEntries(child, nextPrefix));
    }
  }
  return out;
}

function readJsonIfExists(filePath: string): { exists: boolean; data: unknown } {
  if (!fs.existsSync(filePath)) return { exists: false, data: {} };
  try {
    const text = fs.readFileSync(filePath, "utf8");
    return { exists: true, data: JSON.parse(text) };
  } catch {
    return { exists: true, data: {} };
  }
}

function looksNested(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  return Object.values(data as Record<string, unknown>).some((v) => v && typeof v === "object");
}

/** Load the current (read-only) state of a namespace's locale files. */
export function loadLocaleSnapshot(localesRoot: string, namespace: string): LocaleSnapshot {
  const enPath = path.join(localesRoot, "en", `${namespace}.json`);
  const ptBrPath = path.join(localesRoot, "pt-BR", `${namespace}.json`);

  const en = readJsonIfExists(enPath);
  const ptBr = readJsonIfExists(ptBrPath);

  return {
    namespace,
    enPath,
    ptBrPath,
    enExists: en.exists,
    ptBrExists: ptBr.exists,
    enEntries: flattenEntries(en.data),
    ptBrEntries: flattenEntries(ptBr.data),
    isNested: looksNested(en.data),
  };
}

/**
 * Given a candidate key + English value, determine whether it reuses an
 * existing identical entry, collides with a different existing value, or is
 * a genuinely new key.
 */
export function checkKeyAgainstSnapshot(
  snapshot: LocaleSnapshot,
  key: string,
  englishValue: string,
): { reusedExisting: boolean; collision: boolean } {
  const existing = snapshot.enEntries[key];
  if (existing === undefined) return { reusedExisting: false, collision: false };
  if (existing === englishValue) return { reusedExisting: true, collision: false };
  return { reusedExisting: false, collision: true };
}

/** Find an existing key in the namespace whose English value exactly matches (for reuse instead of creating a duplicate). */
export function findExistingKeyForValue(snapshot: LocaleSnapshot, englishValue: string): string | undefined {
  for (const [key, value] of Object.entries(snapshot.enEntries)) {
    if (value === englishValue) return key;
  }
  return undefined;
}

/** Report which of the namespace's proposed keys are missing a pt-BR entry (informational only; no writes). */
export function missingPtBrKeys(snapshot: LocaleSnapshot, keys: string[]): string[] {
  return keys.filter((key) => snapshot.ptBrEntries[key] === undefined);
}
