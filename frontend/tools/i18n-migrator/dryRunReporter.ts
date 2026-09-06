/**
 * Human-readable dry-run report renderer for Phase 2A SAFE_AUTO transformation
 * planning. Purely presentational — no file writes.
 */
import path from "node:path";
import type { NamespaceResolution } from "./namespaceResolver";
import type { TransformPlan } from "./transformer";
import type { ScanResult } from "./types";

function rel(filePath: string): string {
  const r = path.relative(process.cwd(), filePath);
  return r.startsWith("..") ? filePath : r;
}

export function renderDryRunReport(
  targetPath: string,
  scan: ScanResult,
  namespaceResolution: NamespaceResolution,
  plan: TransformPlan | undefined,
): string {
  const lines: string[] = [];
  lines.push("i18n migrate --dry-run (Phase 2A: SAFE_AUTO planning only)");
  lines.push("");
  lines.push("Target:");
  lines.push(targetPath);
  lines.push("");

  lines.push("NAMESPACE RESOLUTION");
  lines.push("");
  lines.push(`resolved namespace: ${namespaceResolution.namespace || "(none — ambiguous)"}`);
  lines.push(`resolution source:  ${namespaceResolution.source}`);
  lines.push(`detail:             ${namespaceResolution.detail}`);
  lines.push("");

  const safeCount = scan.findings.filter((f) => f.classification === "SAFE_AUTO").length;
  const specialCount = scan.findings.filter((f) => f.classification === "SPECIAL_HANDLING").length;
  const manualCount = scan.findings.filter((f) => f.classification === "MANUAL_REVIEW").length;

  if (namespaceResolution.ambiguous || !plan) {
    lines.push("SUMMARY");
    lines.push("");
    lines.push(`Files scanned: ${scan.filesScanned}`);
    lines.push(`SAFE_AUTO findings: ${safeCount}`);
    lines.push(`Transformable findings: 0`);
    lines.push(`Skipped SPECIAL_HANDLING: ${specialCount}`);
    lines.push(`Skipped MANUAL_REVIEW: ${manualCount}`);
    lines.push(`Key collisions: 0`);
    lines.push(`Namespace: (ambiguous — no transformation planned)`);
    return lines.join("\n");
  }

  const allChanges = plan.files.flatMap((f) => f.changes);
  const transformable = allChanges.filter((c) => c.transformable);
  const skipped = allChanges.filter((c) => !c.transformable);

  lines.push("SUMMARY");
  lines.push("");
  lines.push(`Files scanned: ${scan.filesScanned}`);
  lines.push(`SAFE_AUTO findings: ${safeCount}`);
  lines.push(`Transformable findings: ${transformable.length}`);
  lines.push(`Skipped (SAFE_AUTO but not safely transformable): ${skipped.length}`);
  lines.push(`Skipped SPECIAL_HANDLING: ${specialCount}`);
  lines.push(`Skipped MANUAL_REVIEW: ${manualCount}`);
  lines.push(`Key collisions: ${plan.keyCollisions.length}`);
  lines.push(`Namespace: ${plan.namespace}`);
  lines.push("");

  lines.push("PER-FILE PLANNED CHANGES");
  lines.push("");
  for (const file of plan.files) {
    const fileChanges = file.changes.filter((c) => c.transformable);
    if (fileChanges.length === 0) continue;
    lines.push(rel(file.filePath));
    for (const change of fileChanges) {
      lines.push(`  line ${change.line} [${change.kind} ${change.tagOrProp}]`);
      lines.push(`    source:   ${JSON.stringify(change.englishValue)}`);
      lines.push(`    key:      ${change.key}${change.reusedExistingKey ? " (reused existing key)" : " (new key)"}`);
      lines.push(`    proposed: ${change.proposedUsage}`);
    }
    lines.push("");
  }

  const skippedByFile = plan.files.filter((f) => f.changes.some((c) => !c.transformable));
  if (skippedByFile.length > 0) {
    lines.push("SKIPPED SAFE_AUTO FINDINGS (not transformed this phase)");
    lines.push("");
    for (const file of skippedByFile) {
      for (const change of file.changes.filter((c) => !c.transformable)) {
        lines.push(`${rel(file.filePath)}:${change.line} ${JSON.stringify(change.englishValue)}`);
        lines.push(`  reason: ${change.skipReason}`);
      }
    }
    lines.push("");
  }

  lines.push("HOOK / IMPORT CHANGES");
  lines.push("");
  for (const file of plan.files) {
    if (file.hookPlans.length === 0) continue;
    lines.push(rel(file.filePath));
    for (const hookPlan of file.hookPlans) {
      lines.push(`  component ${hookPlan.componentName}: ${hookPlan.detail}`);
      if (hookPlan.needsImport) lines.push(`    + import { useTranslation } from "react-i18next";`);
    }
  }
  lines.push("");

  lines.push("LOCALE PLAN (no files written)");
  lines.push("");
  lines.push(`en/${plan.namespace}.json (proposed keys):`);
  for (const [key, value] of Object.entries(plan.proposedEnEntries)) {
    lines.push(`  ${key} = ${JSON.stringify(value)}`);
  }
  lines.push("");
  lines.push(`pt-BR/${plan.namespace}.json:`);
  const missing = Object.keys(plan.proposedEnEntries);
  lines.push(`  translation required for ${missing.length} key(s); no locale files written this phase`);
  lines.push("");

  if (plan.keyCollisions.length > 0) {
    lines.push("KEY COLLISIONS");
    lines.push("");
    for (const collision of plan.keyCollisions) {
      lines.push(`${rel(collision.filePath)}:${collision.line} key "${collision.key}"`);
      lines.push(`  existing en value: ${JSON.stringify(collision.existingValue)}`);
      lines.push(`  new value:         ${JSON.stringify(collision.newValue)}`);
    }
    lines.push("");
  }

  lines.push("VALIDATION");
  lines.push("");
  for (const file of plan.files) {
    if (!file.validation.valid) {
      lines.push(`${rel(file.filePath)}: INVALID — ${file.validation.diagnostics.join("; ")}`);
    }
  }
  if (plan.files.every((f) => f.validation.valid)) {
    lines.push("all proposed file rewrites re-parsed successfully");
  }

  return lines.join("\n");
}
