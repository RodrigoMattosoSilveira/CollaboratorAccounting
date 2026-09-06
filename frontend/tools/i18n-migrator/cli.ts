#!/usr/bin/env -S node
/**
 * CLI entry point for the i18n migrator.
 *
 *   i18n audit <path>
 *   i18n migrate <path> --dry-run     (SAFE_AUTO planning only, no writes)
 *   i18n migrate <path> --apply       (Phase 2B: writes ONLY the currently
 *                                       `transformable` SAFE_AUTO changes to
 *                                       source + the namespace's en/pt-BR
 *                                       locale files; SPECIAL_HANDLING and
 *                                       MANUAL_REVIEW are never written)
 */
import path from "node:path";
import { applyTransformPlan } from "./apply";
import { classifySourceFile } from "./classifier";
import { renderDryRunReport } from "./dryRunReporter";
import { resolveNamespace } from "./namespaceResolver";
import { renderReport } from "./reporter";
import { scanSourceFiles } from "./scanner";
import { planFeatureTransform } from "./transformer";
import type { ScanResult } from "./types";

function runAudit(targetPath: string): ScanResult {
  const { files, parseFailures } = scanSourceFiles(targetPath);

  const result: ScanResult = {
    filesScanned: files.length,
    findings: [],
    excluded: [],
    parseFailures,
  };

  for (const file of files) {
    const { findings, excluded } = classifySourceFile(file);
    result.findings.push(...findings);
    result.excluded.push(...excluded);
  }

  return result;
}

function buildPlan(targetPath: string) {
  const { files, parseFailures } = scanSourceFiles(targetPath);
  const scan: ScanResult = { filesScanned: files.length, findings: [], excluded: [], parseFailures };
  for (const file of files) {
    const { findings, excluded } = classifySourceFile(file);
    scan.findings.push(...findings);
    scan.excluded.push(...excluded);
  }

  const namespaceResolution = resolveNamespace(
    targetPath,
    files.map((f) => f.sourceFile),
  );

  if (namespaceResolution.ambiguous) {
    return { scan, namespaceResolution, plan: undefined, localesRoot: undefined };
  }

  const localesRoot = path.resolve(process.cwd(), "src", "locales");
  const plan = planFeatureTransform({
    featureDir: targetPath,
    namespace: namespaceResolution.namespace,
    localesRoot,
    files,
  });

  return { scan, namespaceResolution, plan, localesRoot };
}

function runMigrateDryRun(targetPath: string) {
  const { scan, namespaceResolution, plan } = buildPlan(targetPath);
  console.log(renderDryRunReport(targetPath, scan, namespaceResolution, plan));
}

function runMigrateApply(targetPath: string) {
  const { scan, namespaceResolution, plan, localesRoot } = buildPlan(targetPath);

  console.log(renderDryRunReport(targetPath, scan, namespaceResolution, plan));

  if (namespaceResolution.ambiguous || !plan || !localesRoot) {
    console.error("\nApply aborted: namespace is ambiguous, nothing was written.");
    process.exitCode = 1;
    return;
  }

  const transformableCount = plan.files.flatMap((f) => f.changes).filter((c) => c.transformable).length;
  if (transformableCount === 0) {
    console.log("\nNo transformable SAFE_AUTO findings — nothing to apply.");
    return;
  }

  const result = applyTransformPlan(plan, localesRoot);

  console.log("\nAPPLY RESULT");
  console.log("");
  console.log(`Source files written: ${result.sourceFilesWritten.length}`);
  for (const f of result.sourceFilesWritten) console.log(`  ${path.relative(process.cwd(), f)}`);
  console.log(`English locale: ${path.relative(process.cwd(), result.enLocalePath)} (${result.enKeysWritten} keys)`);
  if (result.ptBrLocalePath) {
    console.log(
      `pt-BR locale: ${path.relative(process.cwd(), result.ptBrLocalePath)} ${
        result.ptBrCreatedEmpty ? "(created as empty {} — relies on fallbackLng)" : "(already existed, left untouched)"
      }`,
    );
  }
}

function main() {
  const args = process.argv.slice(2);
  const [command, targetPath] = args;

  if (command === "migrate") {
    if (!targetPath) {
      console.error("Usage: i18n migrate <path> --dry-run|--apply");
      process.exitCode = 1;
      return;
    }
    if (args.includes("--apply")) {
      runMigrateApply(targetPath);
      return;
    }
    if (!args.includes("--dry-run")) {
      console.log("Specify --dry-run (plan only) or --apply (write SAFE_AUTO changes).");
      process.exitCode = 1;
      return;
    }
    runMigrateDryRun(targetPath);
    return;
  }

  if (command !== "audit") {
    console.error("Usage: i18n audit <path>\n       i18n migrate <path> --dry-run|--apply");
    process.exitCode = 1;
    return;
  }

  if (!targetPath) {
    console.error("Usage: i18n audit <path>");
    process.exitCode = 1;
    return;
  }

  const result = runAudit(targetPath);
  console.log(renderReport(targetPath, result));

  if (result.parseFailures.length > 0) {
    process.exitCode = 1;
  }
}

main();
