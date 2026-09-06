/**
 * Standalone fixture test runner (Node 18 environment lacks a working
 * vitest here — pre-existing issue: rolldown requires node:util.styleText,
 * available only in Node 20+). This script exercises the same fixtures
 * using plain `node:assert` so Phase 1 can be validated without vitest.
 *
 * Run with: node_modules/.bin/tsx tools/i18n-migrator/tests/run-fixture-checks.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifySourceFile } from "../classifier";
import { discoverSourceFilePaths, loadSourceFiles, scanSourceFiles } from "../scanner";
import { planFeatureTransform, planFileTransform } from "../transformer";
import { loadLocaleSnapshot } from "../translationStore";
import type { Finding } from "../types";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(currentDir, "fixtures");
const EMPTY_LOCALES_ROOT = path.join(currentDir, "fixtures", "__no-locales-here__");

function scanFixture(fileName: string) {
  const { files, parseFailures } = scanSourceFiles(path.join(FIXTURES_DIR, fileName));
  assert.deepEqual(parseFailures, []);
  assert.equal(files.length, 1);
  return classifySourceFile(files[0]!);
}

/** Plan a Phase 2A transformation for a single fixture file, using an empty (non-existent) locales root. */
function planFixture(fileName: string, namespace = "goldPrices") {
  const filePath = path.join(FIXTURES_DIR, fileName);
  const { files } = loadSourceFiles([filePath]);
  const snapshot = loadLocaleSnapshot(EMPTY_LOCALES_ROOT, namespace);
  const proposedEnEntries: Record<string, string> = {};
  const keyCollisions: ReturnType<typeof planFeatureTransform>["keyCollisions"] = [];
  return planFileTransform(files[0]!, namespace, snapshot, proposedEnEntries, keyCollisions);
}

function planFixtureWithEnSnapshot(fileName: string, enEntries: Record<string, string>, namespace = "goldPrices") {
  const tempLocalesRoot = fs.mkdtempSync(path.join(FIXTURES_DIR, "__tmp_locales__"));
  try {
    const enDir = path.join(tempLocalesRoot, "en");
    fs.mkdirSync(enDir, { recursive: true });
    fs.writeFileSync(path.join(enDir, `${namespace}.json`), JSON.stringify(enEntries, null, 2), "utf8");
    const filePath = path.join(FIXTURES_DIR, fileName);
    const { files } = loadSourceFiles([filePath]);
    const snapshot = loadLocaleSnapshot(tempLocalesRoot, namespace);
    const proposedEnEntries: Record<string, string> = {};
    const keyCollisions: ReturnType<typeof planFeatureTransform>["keyCollisions"] = [];
    return planFileTransform(files[0]!, namespace, snapshot, proposedEnEntries, keyCollisions);
  } finally {
    fs.rmSync(tempLocalesRoot, { recursive: true, force: true });
  }
}

function findByText(findings: Finding[], text: string) {
  return findings.find((f) => f.text === text);
}

function findFinding(findings: Finding[], predicate: (finding: Finding) => boolean) {
  return findings.find(predicate);
}

function fsWriteTemp(filePath: string, content: string) {
  fs.writeFileSync(filePath, content, "utf8");
}

function fsRemoveTemp(filePath: string) {
  fs.rmSync(filePath, { force: true });
}

let passed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`FAIL - ${name}`);
    throw error;
  }
}

test("JSX static text -> SAFE_AUTO", () => {
  const { findings } = scanFixture("jsx-text.tsx");
  assert.equal(findByText(findings, "Gold Prices")?.classification, "SAFE_AUTO");
  assert.equal(findByText(findings, "Save")?.classification, "SAFE_AUTO");
  assert.equal(findByText(findings, "Status")?.classification, "SAFE_AUTO");
});

test("fragmented JSX text becomes SPECIAL_HANDLING", () => {
  const { findings } = scanFixture("fragments.tsx");
  const finding = findFinding(findings, (entry) => entry.classification === "SPECIAL_HANDLING" && entry.category === "JSX_TEXT");
  assert.ok(finding);
  assert.ok(finding!.text.includes("Showing page"));
  assert.ok(finding!.text.includes("receipts"));
});

test("allow-listed prop detected, technical route prop excluded", () => {
  const { findings, excluded } = scanFixture("props.tsx");
  assert.equal(findByText(findings, "Search people")?.classification, "SAFE_AUTO");
  assert.equal(findByText(findings, "People")?.classification, "SAFE_AUTO");
  assert.ok(excluded.some((e) => e.text === "/people"));
});

test("technical strings excluded (enum code, route, locale)", () => {
  const { findings, excluded } = scanFixture("technical-strings.ts");
  assert.deepEqual(findings, []);
  const excludedTexts = excluded.map((e) => e.text);
  assert.ok(excludedTexts.includes("/admin/reference-data"));
  assert.ok(excludedTexts.includes("en-US"));
  assert.ok(excludedTexts.includes("PENDING_ISSUE"));
});

test("value/label pair: value excluded, label SPECIAL_HANDLING", () => {
  const { findings, excluded } = scanFixture("enum-label-pair.ts");
  assert.ok(excluded.some((e) => e.text === "PENDING_ISSUE"));
  assert.equal(findByText(findings, "Pending issue")?.classification, "SPECIAL_HANDLING");
});

test("interpolated template literal -> SPECIAL_HANDLING", () => {
  const { findings } = scanFixture("template-interpolation.ts");
  const finding = findings.find((f) => f.category === "TEMPLATE_LITERAL");
  assert.equal(finding?.classification, "SPECIAL_HANDLING");
  assert.ok(finding?.text.includes("Gold price for"));
});

test("leading-interpolation template literal -> SPECIAL_HANDLING", () => {
  const { findings } = scanFixture("interpolation-leading.tsx");
  const finding = findings.find((f) => f.category === "TEMPLATE_LITERAL");
  assert.equal(finding?.classification, "SPECIAL_HANDLING");
  assert.ok(finding?.text.includes("${name} updated."));
});

test("simple JSX ternaries become SPECIAL_HANDLING", () => {
  const { findings } = scanFixture("ternary-strings.tsx");
  const statuses = findings.filter((f) => f.category === "CONDITIONAL_STRING");
  assert.equal(statuses.length, 2);
  assert.ok(statuses.every((f) => f.classification === "SPECIAL_HANDLING"));
});

test("custom component display props remain conservative", () => {
  const { findings, excluded } = scanFixture("custom-components.tsx");
  assert.equal(findByText(findings, "Create Price List Item")?.classification, "SAFE_AUTO");
  assert.equal(findByText(findings, "Total outstanding")?.classification, "SAFE_AUTO");
  assert.equal(findByText(findings, "Unknown custom text")?.classification, "MANUAL_REVIEW");
  assert.equal(findByText(findings, "Should stay manual")?.classification, "MANUAL_REVIEW");
  assert.ok(excluded.some((e) => e.text === "wide"));
});

test("technical JSX props exclude aria-describedby but preserve aria-label", () => {
  const { findings, excluded } = scanFixture("technical-aria-describedby.tsx");
  assert.equal(findByText(findings, "Signed document reference")?.classification, "SAFE_AUTO");
  assert.ok(excluded.some((e) => e.text === "signed-document-ref-help"));
});

test("existing i18n t(...) not reported as hard-coded", () => {
  const { findings } = scanFixture("existing-i18n.tsx");
  assert.deepEqual(findings, []);
});

test("application audit discovery excludes .test/.spec/__tests__ files", () => {
  const discovered = discoverSourceFilePaths(path.join(FIXTURES_DIR, "discovery"));
  const basenames = discovered.map((p) => path.basename(p)).sort();
  assert.deepEqual(basenames, ["SomePage.tsx"]);
});

test("native-element HTML input configuration attributes excluded", () => {
  const { findings, excluded } = scanFixture("native-technical-props.tsx");
  assert.deepEqual(findings, []);
  const excludedTexts = excluded.map((e) => e.text);
  assert.ok(excludedTexts.includes("decimal"));
  assert.ok(excludedTexts.includes("0.01"));
  assert.ok(excludedTexts.includes("999999"));
  assert.ok(excludedTexts.includes("off"));
});

test("user-facing placeholder still detected on native <input>", () => {
  const { findings } = scanFixture("user-facing-placeholder.tsx");
  const finding = findByText(findings, "Enter gold price");
  assert.equal(finding?.classification, "SAFE_AUTO");
  assert.equal(finding?.category, "JSX_ATTRIBUTE");
  assert.equal(finding?.context, "placeholder");
});

test("helper function return strings -> SPECIAL_HANDLING", () => {
  const { findings } = scanFixture("helper-return-strings.ts");
  assert.equal(findByText(findings, "Print receipt")?.classification, "SPECIAL_HANDLING");
  assert.equal(findByText(findings, "Print receipt")?.category, "FUNCTION_RETURN_STRING");
  assert.equal(findByText(findings, "No action allowed")?.classification, "SPECIAL_HANDLING");
});

test("technical helper return strings never become SAFE_AUTO", () => {
  const { findings, excluded } = scanFixture("technical-helper-return.ts");
  assert.ok(!findings.some((f) => f.classification === "SAFE_AUTO"));
  assert.ok(excluded.some((e) => e.text === "PENDING_ISSUE"));
});

test("plain display-label map: keys not flagged, values SPECIAL_HANDLING", () => {
  const { findings } = scanFixture("display-map.ts");
  assert.ok(!findings.some((f) => f.text === "PENDING_ISSUE"));
  assert.equal(findByText(findings, "Pending issue")?.classification, "SPECIAL_HANDLING");
  assert.equal(findByText(findings, "Returned")?.classification, "SPECIAL_HANDLING");
});

test("static message-setter argument -> SPECIAL_HANDLING", () => {
  const { findings } = scanFixture("message-setter-static.tsx");
  const finding = findByText(findings, "Tenant updated.");
  assert.equal(finding?.classification, "SPECIAL_HANDLING");
  assert.equal(finding?.category, "MESSAGE_SETTER_ARGUMENT");
});

test("dynamic (templated) message-setter argument -> SPECIAL_HANDLING, no duplicate finding", () => {
  const { findings } = scanFixture("message-setter-dynamic.tsx");
  const matches = findings.filter((f) => f.text.includes("updated."));
  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.classification, "SPECIAL_HANDLING");
  assert.equal(matches[0]?.category, "MESSAGE_SETTER_ARGUMENT");
});

test("native <main> with complete standalone text -> SAFE_AUTO", () => {
  const { findings } = scanFixture("native-main-container.tsx");
  assert.equal(findByText(findings, "Receipt not found.")?.classification, "SAFE_AUTO");
  assert.equal(findByText(findings, "Loading receipt...")?.classification, "SAFE_AUTO");
});

test("<code> span text stays MANUAL_REVIEW, never SAFE_AUTO", () => {
  const { findings } = scanFixture("code-span.tsx");
  const finding = findByText(findings, "collaborator-");
  assert.equal(finding?.classification, "MANUAL_REVIEW");
});

// ---------------------------------------------------------------------------
// Phase 2A: transformer planning fixtures
// ---------------------------------------------------------------------------

test("transformer: JSX text + placeholder prop planned as transformable with sensible keys", () => {
  const plan = planFixture("transform-basic.tsx");
  const changes = plan.changes.filter((c) => c.transformable);
  const title = changes.find((c) => c.englishValue === "Gold Prices");
  const placeholder = changes.find((c) => c.englishValue === "Enter gold price");
  assert.equal(title?.key, "goldPrices");
  assert.equal(title?.proposedUsage, '{t("goldPrices")}');
  assert.equal(placeholder?.key, "enterGoldPrice");
  assert.equal(placeholder?.proposedUsage, '{t("enterGoldPrice")}');
});

test("transformer: reuses existing useTranslation hook, does not plan an additional insertion", () => {
  const plan = planFixture("transform-existing-hook.tsx");
  const hookPlan = plan.hookPlans.find((h) => h.componentName === "TransformExistingHookFixture");
  assert.ok(hookPlan);
  assert.equal(hookPlan!.needsHook, false, "existing hook call should be reused, not duplicated");
});

test("transformer: reuses existing react-i18next import statement, only augments named imports", () => {
  const plan = planFixture("transform-existing-import.tsx");
  const hookPlan = plan.hookPlans.find((h) => h.componentName === "TransformExistingImportFixture");
  assert.ok(hookPlan);
  // useTranslation itself is not yet imported, so the planner still marks
  // needsImport true (it must add the named binding) — but the proposed text
  // must augment the existing `react-i18next` import statement rather than
  // adding a second import statement for the same module.
  const importStatements = (plan.proposedText.match(/from ["']react-i18next["']/g) ?? []).length;
  assert.equal(importStatements, 1, "expected the existing react-i18next import to be augmented, not duplicated");
  assert.ok(plan.proposedText.includes("Trans"), "existing Trans import must be preserved");
  assert.ok(plan.proposedText.includes("useTranslation"), "useTranslation must be added to the existing import");
});

test("transformer: multiple components in one file each get their own hook plan", () => {
  const plan = planFixture("transform-multi-component.tsx");
  const names = plan.hookPlans.map((h) => h.componentName).sort();
  assert.deepEqual(names, ["FirstComponent", "SecondComponent"]);
});

test("transformer: identical English value in same file reuses the same key", () => {
  const plan = planFixture("transform-duplicate-value.tsx");
  const changes = plan.changes.filter((c) => c.englishValue === "Current Conversion Source");
  assert.equal(changes.length, 2);
  assert.equal(changes[0]!.key, changes[1]!.key);
  assert.equal(changes[1]!.reusedExistingKey, true);
});

test("transformer: key collision derives deterministic contextual keys instead of skipping immediately", () => {
  const plan = planFixture("transform-collision.tsx");
  const loading = plan.changes.find((c) => c.englishValue === "Loading...");
  const loadingData = plan.changes.find((c) => c.englishValue === "Loading data...");
  const loadingItems = plan.changes.find((c) => c.englishValue === "Loading items...");
  assert.ok(loading && loadingData && loadingItems);
  assert.ok(loading!.transformable && loadingData!.transformable && loadingItems!.transformable);
  const keys = new Set([loading!.key, loadingData!.key, loadingItems!.key]);
  assert.equal(keys.size, 3, "expected deterministic unique contextual keys for colliding base key");
  for (const key of keys) {
    assert.ok(!/\d+$/.test(key), "contextual disambiguation must not use numeric suffixes");
  }
});

test("transformer: retries contextual collision resolution when first contextual key also collides", () => {
  const plan = planFixtureWithEnSnapshot("transform-contextual-collision.tsx", {
    loading: "Loading authenticated actor…",
    loadingP: "Loading people...",
    loadingLatestGoldPrice: "Legacy colliding value",
  });
  const change = plan.changes.find((c) => c.englishValue === "Loading latest gold price...");
  assert.ok(change, "expected collision candidate");
  assert.ok(change!.transformable, "expected contextual retry to eventually find a unique key");
  assert.notEqual(change!.key, "loading");
  assert.notEqual(change!.key, "loadingP");
  assert.notEqual(change!.key, "loadingLatestGoldPrice");
  assert.ok(change!.key.startsWith("loading"));
});

test("transformer: SPECIAL_HANDLING and MANUAL_REVIEW findings are never planned for transformation", () => {
  const plan = planFixture("fragments.tsx");
  // fragments.tsx's classifier findings are SPECIAL_HANDLING; the transformer
  // must not have produced any transformable change for the fragmented text.
  assert.equal(plan.changes.length, 0);
});

test("transformer: technical strings (enum-like values, routes) never appear as planned changes", () => {
  const plan = planFixture("technical-strings.ts");
  assert.equal(plan.changes.length, 0);
});

test("transformer: proposed spliced source re-parses as valid TypeScript", () => {
  const plan = planFixture("transform-basic.tsx");
  assert.equal(plan.validation.valid, true);
});

test("transformer: idempotent second pass over already-transformed text plans zero further changes", () => {
  const plan = planFixture("transform-basic.tsx");
  assert.ok(plan.proposedText, "expected a proposed rewritten text for the first pass");

  // Write the *proposed* text to a temp fixture-like path in memory by
  // re-parsing it directly (no disk write) and re-running the planner logic
  // used by planFileTransform's candidate collection via a second scan.
  const tmpDir = FIXTURES_DIR;
  const tmpPath = path.join(tmpDir, "__idempotency_tmp__.tsx");
  fsWriteTemp(tmpPath, plan.proposedText!);
  try {
    const secondPlan = planFixture("__idempotency_tmp__.tsx");
    const stillTransformable = secondPlan.changes.filter((c) => c.transformable);
    assert.equal(stillTransformable.length, 0, "second pass should find nothing left to transform");
    assert.equal(secondPlan.hookPlans.length, 0, "second pass should not plan a duplicate hook");
  } finally {
    fsRemoveTemp(tmpPath);
  }
});

test("transformer: CONDITIONAL_STRING branches become transformable t(...) calls", () => {
  const plan = planFixture("transform-conditional.tsx");
  const recording = plan.changes.find((c) => c.englishValue === "Recording...");
  const record = plan.changes.find((c) => c.englishValue === "Record Gold Price");
  assert.ok(recording && record, "expected both conditional branches to be planned");
  assert.equal(recording!.kind, "CONDITIONAL_STRING");
  assert.equal(record!.kind, "CONDITIONAL_STRING");
  assert.ok(recording!.transformable && record!.transformable);
  assert.ok(plan.proposedText!.includes(`isPending ? t("`), "expected conditional branches spliced with bare t(...) calls");
  assert.equal(plan.validation.valid, true);
});

test("transformer: MESSAGE_SETTER_ARGUMENT template literal becomes interpolated t(key, {vars})", () => {
  const plan = planFixture("transform-message-setter-template.tsx");
  const change = plan.changes.find((c) => c.kind === "MESSAGE_SETTER_ARGUMENT");
  assert.ok(change, "expected a MESSAGE_SETTER_ARGUMENT change");
  assert.equal(change!.englishValue, "Gold price for {{priceDate}} recorded.");
  assert.ok(change!.interpolation && change!.interpolation.priceDate === "created.priceDate");
  assert.ok(
    plan.proposedText!.includes(`setSuccessMessage(t("`) && plan.proposedText!.includes("{ priceDate: created.priceDate }"),
    "expected setSuccessMessage(...) call spliced with an interpolated t(key, {...}) call",
  );
  assert.equal(plan.validation.valid, true);
});

test("transformer: fragmented JSX with a single nested child becomes transformable", () => {
  const plan = planFixture("transform-fragment-simple.tsx");
  const change = plan.changes.find((c) => c.englishValue === "Price Date");
  assert.ok(change, "expected leading text of the simple <label>Price Date<input /></label> fragment to be planned");
  assert.equal(change!.kind, "JSX_FRAGMENT_TEXT");
  assert.ok(change!.transformable);
  assert.equal(plan.validation.valid, true);
});

test("transformer: fragmented JSX with multiple interleaved expressions remains non-transformable", () => {
  const plan = planFixture("transform-fragment-simple.tsx");
  const multiExprChanges = plan.changes.filter(
    (c) => c.englishValue.includes("Showing page") || c.englishValue.includes("receipts"),
  );
  assert.equal(multiExprChanges.length, 0, "multi-interleaved-expression fragment must remain SPECIAL_HANDLING, not planned");
});

test("transformer: single-expression fragmented JSX sentence becomes one interpolated translation unit", () => {
  const plan = planFixture("transform-fragment-interpolated.tsx");
  const formula = plan.changes.find((c) => c.englishValue === "BRL ÷ {{brlPerGram}} = grams");
  const example = plan.changes.find((c) => c.englishValue === "Example: R$ 1.00 converts to {{gramsPerBrl}} g using this source.");
  assert.ok(formula, "expected a single interpolated candidate for the <dd> formula fragment");
  assert.ok(example, "expected a single interpolated candidate for the <p> example fragment");
  assert.equal(formula!.kind, "JSX_FRAGMENT_INTERPOLATED");
  assert.equal(example!.kind, "JSX_FRAGMENT_INTERPOLATED");
  assert.deepEqual(formula!.interpolation, { brlPerGram: "formatDecimal(goldPrice.brlPerGram)" });
  assert.deepEqual(example!.interpolation, { gramsPerBrl: "formatDecimal(gramsPerBrl, 6)" });
  assert.ok(plan.proposedText!.includes("{t(\"") && plan.proposedText!.includes("{ brlPerGram: formatDecimal(goldPrice.brlPerGram) }"));
  assert.ok(plan.proposedText!.includes("{ gramsPerBrl: formatDecimal(gramsPerBrl, 6) }"));
  assert.equal(plan.validation.valid, true);
});

test("transformer: standalone direct text in multi-child fragment is transformable", () => {
  const plan = planFixture("transform-fragment-direct-text-multi.tsx");
  const recordedBy = plan.changes.find((c) => c.englishValue === "Recorded By");
  assert.ok(recordedBy, "expected standalone direct text to be planned");
  assert.equal(recordedBy!.kind, "JSX_FRAGMENT_TEXT");
  assert.ok(recordedBy!.transformable);
  assert.ok(plan.proposedText!.includes(`{t("${recordedBy!.key}")}`));
  assert.equal(plan.validation.valid, true);
});

test("transformer: interdependent multi-child fragment text remains non-transformable", () => {
  const plan = planFixture("transform-fragment-direct-text-multi.tsx");
  const interdependent = plan.changes.filter((c) => c.englishValue.includes("Showing") || c.englishValue.includes("items"));
  assert.equal(interdependent.length, 0, "expected interdependent multi-text fragment to remain SPECIAL_HANDLING");
});

test("transformer: second pass over standalone multi-child direct text plans zero further changes", () => {
  const plan = planFixture("transform-fragment-direct-text-multi.tsx");
  assert.ok(plan.proposedText);
  const tmpPath = path.join(FIXTURES_DIR, "__idempotency_direct_text_multi_tmp__.tsx");
  fsWriteTemp(tmpPath, plan.proposedText!);
  try {
    const secondPlan = planFixture("__idempotency_direct_text_multi_tmp__.tsx");
    const stillTransformable = secondPlan.changes.filter((c) => c.transformable);
    assert.equal(stillTransformable.length, 0, "second pass should find nothing left to transform");
  } finally {
    fsRemoveTemp(tmpPath);
  }
});

test("transformer: second pass over already-transformed CONDITIONAL_STRING plans zero further changes", () => {
  const plan = planFixture("transform-conditional.tsx");
  assert.ok(plan.proposedText);
  const tmpPath = path.join(FIXTURES_DIR, "__idempotency_conditional_tmp__.tsx");
  fsWriteTemp(tmpPath, plan.proposedText!);
  try {
    const secondPlan = planFixture("__idempotency_conditional_tmp__.tsx");
    const stillTransformable = secondPlan.changes.filter((c) => c.transformable);
    assert.equal(stillTransformable.length, 0, "second pass should find nothing left to transform");
  } finally {
    fsRemoveTemp(tmpPath);
  }
});

console.log(`
${passed} test(s) passed`);
