/**
 * Namespace resolution for Phase 2A transformation planning (read-only).
 *
 * Resolution order (per Phase 2A spec):
 *   1. Existing `useTranslation("...")` call already in the file
 *   2. Existing namespace convention observed in sibling files of the same feature
 *   3. Configured feature-directory -> namespace mapping
 *   4. Derive a camelCase namespace from the feature directory name (new namespace only)
 *   5. If still ambiguous (e.g. sibling files disagree), resolution fails and the
 *      caller must not transform.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

/** Explicit feature-directory -> namespace overrides for known conventions. */
const FEATURE_NAMESPACE_MAP: Readonly<Record<string, string>> = {
  "current-accounts": "currentAccounts",
  "gold-prices": "goldPrices",
  "price-list": "priceList",
  "reference-data": "referenceData",
};

export interface NamespaceResolution {
  namespace: string;
  source: "existing-usage" | "sibling-convention" | "configured-mapping" | "derived-new" | "ambiguous";
  ambiguous: boolean;
  detail: string;
}

/** camelCase a kebab-case or snake_case directory name, e.g. "gold-prices" -> "goldPrices". */
function camelCaseFromDirName(dirName: string): string {
  return dirName
    .split(/[-_]/)
    .map((part, index) => (index === 0 ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()))
    .join("");
}

/** Find every `useTranslation("...")` namespace literal argument in a source file. */
function findUseTranslationNamespaces(sourceFile: ts.SourceFile): string[] {
  const found: string[] = [];

  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "useTranslation" &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0]!)
    ) {
      found.push((node.arguments[0] as ts.StringLiteral).text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

/** Resolve the i18n namespace to use for a given feature directory. */
export function resolveNamespace(featureDir: string, sourceFiles: ts.SourceFile[]): NamespaceResolution {
  // 1. Existing useTranslation(...) usage in the files under audit.
  const usagesPerFile = sourceFiles.map((sf) => findUseTranslationNamespaces(sf));
  const allUsages = usagesPerFile.flat();
  const distinctUsages = Array.from(new Set(allUsages));

  if (distinctUsages.length === 1) {
    return {
      namespace: distinctUsages[0]!,
      source: "existing-usage",
      ambiguous: false,
      detail: `found existing useTranslation("${distinctUsages[0]}") in the audited files`,
    };
  }
  if (distinctUsages.length > 1) {
    return {
      namespace: "",
      source: "ambiguous",
      ambiguous: true,
      detail: `multiple distinct useTranslation namespaces already present: ${distinctUsages.join(", ")}`,
    };
  }

  // 2. Sibling-file convention: look at other files in the same feature directory
  //    (not just the audited subset) for an existing useTranslation call.
  const dirName = path.basename(path.resolve(featureDir));
  let siblingNamespaces: string[] = [];
  try {
    const siblingFiles = fs
      .readdirSync(path.resolve(featureDir))
      .filter((f) => /\.tsx?$/.test(f) && !/\.(test|spec)\.tsx?$/.test(f));
    for (const file of siblingFiles) {
      const fullPath = path.join(path.resolve(featureDir), file);
      if (sourceFiles.some((sf) => sf.fileName === fullPath)) continue; // already checked above
      const text = fs.readFileSync(fullPath, "utf8");
      const sf = ts.createSourceFile(fullPath, text, ts.ScriptTarget.ES2022, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      siblingNamespaces.push(...findUseTranslationNamespaces(sf));
    }
  } catch {
    // Directory unreadable; fall through to configured/derived resolution.
  }
  siblingNamespaces = Array.from(new Set(siblingNamespaces));

  if (siblingNamespaces.length === 1) {
    return {
      namespace: siblingNamespaces[0]!,
      source: "sibling-convention",
      ambiguous: false,
      detail: `no useTranslation in audited files, but sibling file(s) in ${dirName} already use "${siblingNamespaces[0]}"`,
    };
  }
  if (siblingNamespaces.length > 1) {
    return {
      namespace: "",
      source: "ambiguous",
      ambiguous: true,
      detail: `sibling files in ${dirName} disagree on namespace: ${siblingNamespaces.join(", ")}`,
    };
  }

  // 3. Configured feature-to-namespace mapping.
  if (FEATURE_NAMESPACE_MAP[dirName]) {
    return {
      namespace: FEATURE_NAMESPACE_MAP[dirName]!,
      source: "configured-mapping",
      ambiguous: false,
      detail: `no existing usage found; using configured mapping "${dirName}" -> "${FEATURE_NAMESPACE_MAP[dirName]}"`,
    };
  }

  // 4. Derive a new namespace from the feature directory name.
  const derived = camelCaseFromDirName(dirName);
  return {
    namespace: derived,
    source: "derived-new",
    ambiguous: false,
    detail: `no existing usage or configured mapping; derived new namespace "${derived}" from directory name "${dirName}"`,
  };
}
