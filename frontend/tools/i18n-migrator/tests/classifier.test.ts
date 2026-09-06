import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifySourceFile } from "../classifier";
import { discoverSourceFilePaths, scanSourceFiles } from "../scanner";
import type { Finding } from "../types";

const FIXTURES_DIR = path.join(__dirname, "fixtures");

function scanFixture(fileName: string) {
  const { files, parseFailures } = scanSourceFiles(path.join(FIXTURES_DIR, fileName));
  expect(parseFailures).toEqual([]);
  expect(files).toHaveLength(1);
  return classifySourceFile(files[0]!);
}

function findByText(findings: Finding[], text: string) {
  return findings.find((f) => f.text === text);
}

describe("i18n-migrator classifier", () => {
  it("detects JSX static text as SAFE_AUTO", () => {
    const { findings } = scanFixture("jsx-text.tsx");

    expect(findByText(findings, "Gold Prices")).toMatchObject({
      classification: "SAFE_AUTO",
      category: "JSX_TEXT",
    });
    expect(findByText(findings, "Save")).toMatchObject({ classification: "SAFE_AUTO" });
    expect(findByText(findings, "Status")).toMatchObject({ classification: "SAFE_AUTO" });
  });

  it("detects allow-listed props but excludes technical route props", () => {
    const { findings, excluded } = scanFixture("props.tsx");

    expect(findByText(findings, "Search people")).toMatchObject({
      classification: "SAFE_AUTO",
      category: "JSX_ATTRIBUTE",
      context: "placeholder",
    });
    expect(findByText(findings, "People")).toMatchObject({
      classification: "SAFE_AUTO",
      category: "JSX_TEXT",
    });
    expect(excluded.some((e) => e.text === "/people")).toBe(true);
  });

  it("excludes technical strings (enum codes, routes, locale identifiers)", () => {
    const { findings, excluded } = scanFixture("technical-strings.ts");

    expect(findings).toEqual([]);
    const excludedTexts = excluded.map((e) => e.text);
    expect(excludedTexts).toContain("/admin/reference-data");
    expect(excludedTexts).toContain("en-US");
    expect(excludedTexts).toContain("PENDING_ISSUE");
  });

  it("classifies value/label pairs: value excluded, label SPECIAL_HANDLING", () => {
    const { findings, excluded } = scanFixture("enum-label-pair.ts");

    expect(excluded.some((e) => e.text === "PENDING_ISSUE")).toBe(true);
    expect(findByText(findings, "Pending issue")).toMatchObject({
      classification: "SPECIAL_HANDLING",
      category: "OBJECT_PROPERTY",
    });
  });

  it("classifies interpolated template literals as SPECIAL_HANDLING", () => {
    const { findings } = scanFixture("template-interpolation.ts");

    const finding = findings.find((f) => f.category === "TEMPLATE_LITERAL");
    expect(finding).toMatchObject({ classification: "SPECIAL_HANDLING" });
    expect(finding?.text).toContain("Gold price for");
  });

  it("does not report already-translated JSX (t(...) calls) as hard-coded text", () => {
    const { findings } = scanFixture("existing-i18n.tsx");
    expect(findings).toEqual([]);
  });

  it("excludes .test.tsx/.spec.tsx/__tests__ files from application audit discovery", () => {
    const discovered = discoverSourceFilePaths(path.join(FIXTURES_DIR, "discovery"));
    const basenames = discovered.map((p) => path.basename(p)).sort();
    expect(basenames).toEqual(["SomePage.tsx"]);
  });

  it("excludes native-element HTML input configuration attributes", () => {
    const { findings, excluded } = scanFixture("native-technical-props.tsx");

    expect(findings).toEqual([]);
    const excludedTexts = excluded.map((e) => e.text);
    expect(excludedTexts).toContain("decimal");
    expect(excludedTexts).toContain("0.01");
    expect(excludedTexts).toContain("999999");
    expect(excludedTexts).toContain("off");
  });

  it("still detects user-facing placeholder text on native <input>", () => {
    const { findings } = scanFixture("user-facing-placeholder.tsx");
    expect(findByText(findings, "Enter gold price")).toMatchObject({
      classification: "SAFE_AUTO",
      category: "JSX_ATTRIBUTE",
      context: "placeholder",
    });
  });
});
