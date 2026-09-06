/**
 * Phase 2B: controlled APPLY of a previously-planned SAFE_AUTO TransformPlan.
 *
 * This is the ONLY module in the migrator permitted to write to disk. It is
 * intentionally thin: it writes exactly what `transformer.ts` already
 * computed (proposedText per file, proposedEnEntries for the namespace) with
 * no additional guessing. Only `transformable: true` changes ever reach the
 * plan's `proposedText` in the first place (see transformer.ts), so apply
 * never needs to re-filter — but we still assert on it defensively.
 */
import fs from "node:fs";
import path from "node:path";
import type { TransformPlan } from "./transformer";

export interface ApplyResult {
  sourceFilesWritten: string[];
  enLocalePath: string;
  enKeysWritten: number;
  ptBrLocalePath: string | undefined;
  ptBrCreatedEmpty: boolean;
}

/**
 * Apply a TransformPlan to disk:
 *  - overwrite each file's proposedText (only if it actually differs and validation passed)
 *  - write en/<namespace>.json with the proposed English entries (flat, since this is a brand-new namespace)
 *  - write pt-BR/<namespace>.json as {} ONLY if it does not already exist (never overwrite real translations)
 */
export function applyTransformPlan(plan: TransformPlan, localesRoot: string): ApplyResult {
  const sourceFilesWritten: string[] = [];

  for (const file of plan.files) {
    const hasTransformableChange = file.changes.some((c) => c.transformable);
    if (!hasTransformableChange) continue;
    if (!file.validation.valid) {
      throw new Error(`refusing to apply ${file.filePath}: proposed rewrite failed validation`);
    }
    if (file.proposedText === file.originalText) continue;
    fs.writeFileSync(file.filePath, file.proposedText, "utf8");
    sourceFilesWritten.push(file.filePath);
  }

  const enDir = path.join(localesRoot, "en");
  const ptBrDir = path.join(localesRoot, "pt-BR");
  const enPath = path.join(enDir, `${plan.namespace}.json`);
  const ptBrPath = path.join(ptBrDir, `${plan.namespace}.json`);

  fs.mkdirSync(enDir, { recursive: true });
  const sortedEnEntries = Object.fromEntries(
    Object.entries(plan.proposedEnEntries).sort(([a], [b]) => a.localeCompare(b)),
  );
  fs.writeFileSync(enPath, `${JSON.stringify(sortedEnEntries, null, 2)}\n`, "utf8");

  let ptBrCreatedEmpty = false;
  if (!fs.existsSync(ptBrPath)) {
    fs.mkdirSync(ptBrDir, { recursive: true });
    fs.writeFileSync(ptBrPath, "{}\n", "utf8");
    ptBrCreatedEmpty = true;
  }

  return {
    sourceFilesWritten,
    enLocalePath: enPath,
    enKeysWritten: Object.keys(plan.proposedEnEntries).length,
    ptBrLocalePath: ptBrPath,
    ptBrCreatedEmpty,
  };
}
