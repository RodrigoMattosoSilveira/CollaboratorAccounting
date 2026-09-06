/**
 * Human-readable audit report renderer.
 */
import path from "node:path";
import type { Classification, ScanResult } from "./types";

const SECTION_ORDER: Classification[] = ["SAFE_AUTO", "SPECIAL_HANDLING", "MANUAL_REVIEW"];
const SECTION_LABEL: Record<Classification, string> = {
  SAFE_AUTO: "SAFE AUTO",
  SPECIAL_HANDLING: "SPECIAL HANDLING",
  MANUAL_REVIEW: "MANUAL REVIEW",
};

function relativeLabel(targetPath: string, filePath: string): string {
  const rel = path.relative(process.cwd(), filePath);
  return rel.startsWith("..") ? filePath : rel;
}

export function renderReport(targetPath: string, result: ScanResult): string {
  const lines: string[] = [];
  lines.push("i18n audit");
  lines.push("");
  lines.push("Target:");
  lines.push(targetPath);
  lines.push("");

  for (const classification of SECTION_ORDER) {
    const group = result.findings.filter((f) => f.classification === classification);
    if (group.length === 0) continue;

    lines.push(SECTION_LABEL[classification]);
    lines.push("");
    for (const finding of group) {
      lines.push(`${relativeLabel(targetPath, finding.filePath)}:${finding.line}`);
      lines.push(`  ${finding.category}`);
      lines.push(`  ${JSON.stringify(finding.text)}`);
      lines.push(`  reason: ${finding.reason}`);
      lines.push("");
    }
  }

  if (result.parseFailures.length > 0) {
    lines.push("PARSE FAILURES");
    lines.push("");
    for (const failure of result.parseFailures) {
      lines.push(`${relativeLabel(targetPath, failure.filePath)}: ${failure.message}`);
    }
    lines.push("");
  }

  const counts = SECTION_ORDER.map(
    (c) => [c, result.findings.filter((f) => f.classification === c).length] as const,
  );

  lines.push("SUMMARY");
  lines.push("");
  lines.push(`Files scanned: ${result.filesScanned}`);
  for (const [classification, count] of counts) {
    lines.push(`${SECTION_LABEL[classification]}: ${count}`);
  }
  lines.push(`Excluded technical strings: ${result.excluded.length}`);
  lines.push(`Parse failures: ${result.parseFailures.length}`);

  return lines.join("\n");
}
