/**
 * Phase 2A SAFE_AUTO transformer — DRY-RUN / IN-MEMORY ONLY.
 *
 * This module never writes to disk. It re-walks the same AST shapes the
 * classifier recognizes as SAFE_AUTO (JSX whole-string text in safe/
 * container tags, allow-listed native props, vetted custom-component props)
 * and produces a text-splice plan: proposed replacement text, proposed
 * import/hook changes, and a validation result from re-parsing the modified
 * source. SPECIAL_HANDLING/MANUAL_REVIEW/EXCLUDED findings are left
 * completely untouched — this module does not even attempt to rewrite them.
 */
import fs from "node:fs";
import ts from "typescript";
import {
  ALLOWED_TEXT_PROPS,
  KNOWN_CUSTOM_SAFE_TEXT_PROPS,
  NATIVE_ELEMENT_TECHNICAL_PROPS,
  SAFE_TEXT_CONTAINER_TAGS,
  SAFE_TEXT_TAGS,
  TECHNICAL_DISPLAY_TAGS,
  UI_MESSAGE_SETTER_NAME_PATTERN,
} from "./config";
import { isDeniedTechnicalPropName } from "./exclusions";
import { generateKeyCandidate } from "./keyGenerator";
import type { LoadedSourceFile } from "./scanner";
import {
  checkKeyAgainstSnapshot,
  findExistingKeyForValue,
  loadLocaleSnapshot,
  missingPtBrKeys,
  type LocaleSnapshot,
} from "./translationStore";
import { validateSourceText } from "./validator";

/**
 * Phase 2B-planning extension: in addition to the original SAFE_AUTO shapes
 * (JSX_TEXT / JSX_ATTRIBUTE), this module can now also PLAN (dry-run only,
 * never applied by this module on its own) transformations for four
 * generic SPECIAL_HANDLING shapes, mirroring classifier.ts's own detection
 * rules for these categories:
 *
 *   - CONDITIONAL_STRING: `cond ? "A" : "B"` -> `cond ? t("a") : t("b")`
 *   - TEMPLATE_LITERAL: `` `Text ${expr} more.` `` -> `t("key", { name: expr })`
 *   - MESSAGE_SETTER_ARGUMENT: `setXMessage(`...${expr}...`)` -> same
 *     interpolation mechanism applied to the call argument.
 *   - JSX_FRAGMENT_TEXT / JSX_FRAGMENT_INTERPOLATED: fragmented JSX where
 *     static text surrounds nested elements/expressions. Single-expression
 *     wrapped phrases become one interpolated `t("key", { value: expr })`
 *     unit; simpler nested-element wraps keep static text-run replacement.
 *
 * These new candidate kinds are collected in `collectRawCandidates` and
 * spliced by `buildProposedText` using the exact same key-generation,
 * collision-detection, hook/import-planning, and re-parse-validation
 * pipeline as the original SAFE_AUTO candidates. The caller (cli.ts) is
 * responsible for keeping this extension's proposals in a "planned, not
 * applied" state until explicitly approved.
 */
export type PlannedChangeKind =
  | "JSX_TEXT"
  | "JSX_ATTRIBUTE"
  | "CONDITIONAL_STRING"
  | "TEMPLATE_LITERAL"
  | "MESSAGE_SETTER_ARGUMENT"
  | "JSX_FRAGMENT_TEXT"
  | "JSX_FRAGMENT_INTERPOLATED";

export interface PlannedChange {
  filePath: string;
  line: number;
  kind: PlannedChangeKind;
  tagOrProp: string;
  englishValue: string;
  key: string;
  reusedExistingKey: boolean;
  collision: boolean;
  proposedUsage: string;
  /** False when key generation/collision made this ambiguous — caller should not apply it. */
  transformable: boolean;
  skipReason?: string;
  /** Present for TEMPLATE_LITERAL / MESSAGE_SETTER_ARGUMENT: interpolation var name -> source expression text. */
  interpolation?: Record<string, string>;
}

export interface HookPlan {
  filePath: string;
  componentName: string;
  needsImport: boolean;
  needsHook: boolean;
  detail: string;
}

export interface FileTransformPlan {
  filePath: string;
  namespace: string;
  changes: PlannedChange[];
  hookPlans: HookPlan[];
  /** Full proposed file text after applying only the `transformable` changes + import/hook insertion. */
  proposedText: string;
  originalText: string;
  validation: { valid: boolean; diagnostics: string[] };
}

export interface TransformPlan {
  namespace: string;
  files: FileTransformPlan[];
  localeSnapshotBefore: LocaleSnapshot;
  proposedEnEntries: Record<string, string>;
  keyCollisions: Array<{ key: string; existingValue: string; newValue: string; filePath: string; line: number }>;
}

function isNativeElementTag(tagName: string | undefined): boolean {
  return !!tagName && /^[a-z]/.test(tagName);
}

function jsxTagName(node: ts.JsxElement | ts.JsxFragment): string | undefined {
  if (ts.isJsxFragment(node)) return undefined;
  const tag = node.openingElement.tagName;
  return ts.isIdentifier(tag) ? tag.text : tag.getText();
}

function enclosingTagName(attribute: ts.JsxAttribute): string | undefined {
  const owner = attribute.parent.parent;
  const tag = owner.tagName;
  return ts.isIdentifier(tag) ? tag.text : tag.getText();
}

function isMeaningfulJsxText(text: string): boolean {
  return text.replace(/\s+/g, " ").trim().length > 0;
}

/** Mirrors classifier.ts's isPunctuationOnly: excludes text with no visible word characters (e.g. "—", "*"). */
function isPunctuationOnly(text: string): boolean {
  return !/[A-Za-z0-9]/.test(text);
}

/** Find the nearest enclosing function component (capitalized function/arrow) for hook placement. */
function getEnclosingComponent(node: ts.Node): { name: string; body: ts.Block | undefined } | undefined {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name && /^[A-Z]/.test(current.name.text) && current.body) {
      return { name: current.name.text, body: current.body };
    }
    if (
      ts.isVariableDeclaration(current) &&
      ts.isIdentifier(current.name) &&
      /^[A-Z]/.test(current.name.text) &&
      current.initializer &&
      ts.isArrowFunction(current.initializer) &&
      ts.isBlock(current.initializer.body)
    ) {
      return { name: current.name.text, body: current.initializer.body as ts.Block };
    }
    current = current.parent;
  }
  return undefined;
}

interface RawCandidate {
  node: ts.StringLiteral | ts.JsxText | ts.TemplateExpression | ts.NoSubstitutionTemplateLiteral | ts.JsxExpression;
  kind: PlannedChangeKind;
  tagOrProp: string;
  text: string;
  line: number;
  component: { name: string; body: ts.Block | undefined } | undefined;
  /** Present only for TEMPLATE_LITERAL / MESSAGE_SETTER_ARGUMENT / CONDITIONAL_STRING branches that are templates. */
  interpolation?: Record<string, string>;
}

function getJsxAttributeAncestor(node: ts.Node): ts.JsxAttribute | undefined {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isJsxAttribute(current)) return current;
    current = current.parent;
  }
  return undefined;
}

function isTechnicalJsxAttributeLocal(propName: string, tagName: string | undefined): boolean {
  if (isDeniedTechnicalPropName(propName)) return true;
  return Boolean(tagName && isNativeElementTag(tagName) && NATIVE_ELEMENT_TECHNICAL_PROPS.has(propName));
}

/** Mirrors classifier.ts's isConditionalTechnicalContext: a conditional living inside a technical JSX attribute is never transformed. */
function isConditionalTechnicalContextLocal(node: ts.ConditionalExpression): boolean {
  const jsxAttr = getJsxAttributeAncestor(node);
  if (!jsxAttr) return false;
  const propName = jsxAttr.name.getText();
  const tagName = enclosingTagName(jsxAttr);
  return isTechnicalJsxAttributeLocal(propName, tagName);
}

function templateRawTextLocal(node: ts.TemplateExpression): string {
  return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join("");
}

/** Mirrors classifier.ts's templateLooksUserFacing: at least one 2+ letter run in the literal portions. */
function templateLooksUserFacingLocal(node: ts.TemplateExpression): boolean {
  return /[A-Za-z]{2,}/.test(templateRawTextLocal(node));
}

/** Mirrors classifier.ts's isTechnicalTemplateContext's text-shape checks (route/URL/curl/className-like literals). */
function isTechnicalTemplateTextLocal(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("/") && !trimmed.includes(" ")) return true;
  if (/^https?:\/\//.test(trimmed)) return true;
  if (/^\s*(-H\b|curl\b)/.test(trimmed) || trimmed.includes('"X-Tenant-ID:') || trimmed.includes("curl -i")) return true;
  if (
    trimmed.includes("px-") ||
    trimmed.includes("py-") ||
    trimmed.includes("bg-") ||
    trimmed.includes("text-") ||
    trimmed.includes("border-") ||
    trimmed.includes("rounded-") ||
    trimmed.includes("shadow-") ||
    trimmed.includes("grid") ||
    trimmed.includes("flex")
  ) {
    return true;
  }
  return false;
}

function isTechnicalTemplateContextLocal(node: ts.TemplateExpression): boolean {
  const jsxAttr = getJsxAttributeAncestor(node);
  if (jsxAttr) {
    const propName = jsxAttr.name.getText();
    const tagName = enclosingTagName(jsxAttr);
    if (isTechnicalJsxAttributeLocal(propName, tagName)) return true;
  }
  return isTechnicalTemplateTextLocal(templateRawTextLocal(node));
}

/** Derive a deterministic camelCase interpolation variable name from a template-span expression. */
function deriveInterpolationName(expr: ts.Expression): string {
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isCallExpression(expr) && expr.arguments.length > 0) {
    const firstArg = expr.arguments[0];
    if (ts.isExpression(firstArg)) {
      return deriveInterpolationName(firstArg);
    }
  }
  if (ts.isElementAccessExpression(expr) && ts.isStringLiteralLike(expr.argumentExpression)) {
    return expr.argumentExpression.text;
  }
  return "value";
}

/**
 * Extract an i18next-style English value (with `{{name}}` placeholders) and
 * an interpolation map (name -> source expression text) from a template
 * expression, deterministically naming each placeholder after the rightmost
 * identifier/property-access segment of its expression (generic — not
 * hardcoded to any specific feature's variable names).
 */
function extractTemplateInterpolation(node: ts.TemplateExpression): { enValue: string; interpolation: Record<string, string> } {
  const interpolation: Record<string, string> = {};
  const usedNames = new Map<string, string>(); // name -> exprText already assigned to it
  let enValue = node.head.text;
  for (const span of node.templateSpans) {
    const exprText = span.expression.getText();
    let name = deriveInterpolationName(span.expression);
    const existingExprForName = usedNames.get(name);
    if (existingExprForName !== undefined && existingExprForName !== exprText) {
      let index = 2;
      let candidate = `${name}${index}`;
      while (usedNames.has(candidate) && usedNames.get(candidate) !== exprText) {
        index += 1;
        candidate = `${name}${index}`;
      }
      name = candidate;
    }
    usedNames.set(name, exprText);
    interpolation[name] = exprText;
    enValue += `{{${name}}}${span.literal.text}`;
  }
  return { enValue, interpolation };
}

/** Extract a plain-string or interpolated English value from a "simple text branch" node (string literal, no-substitution template, or template expression). */
function extractLiteralOrTemplateValue(
  node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | ts.TemplateExpression,
): { enValue: string; interpolation?: Record<string, string> } {
  if (ts.isTemplateExpression(node)) {
    return extractTemplateInterpolation(node);
  }
  return { enValue: node.text };
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function splitWords(text: string): string[] {
  return text
    .replace(/\{\{[^}]+\}\}/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function toPascalCase(words: string[]): string {
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

function splitCamelCaseWords(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.toLowerCase());
}

function normalizeContextToken(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, " ").trim();
}

function deriveContextualSuffixes(candidate: RawCandidate, baseKey: string): string[] {
  const suffixes: string[] = [];
  const seen = new Set<string>();
  const add = (value: string | undefined) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!/^[A-Za-z]/.test(trimmed)) return;
    if (seen.has(trimmed)) return;
    seen.add(trimmed);
    suffixes.push(trimmed);
  };

  const roleToken = toPascalCase(splitWords(normalizeContextToken(candidate.tagOrProp)));
  add(roleToken);

  const textWords = splitWords(candidate.text);
  const baseWords = new Set(splitCamelCaseWords(baseKey));
  const significant = textWords
    .map((word) => word.toLowerCase())
    .filter((word) => word.length >= 3 && !baseWords.has(word))
    .slice(0, 4);
  if (significant.length > 0) {
    add(toPascalCase(significant));
  }

  const componentToken = candidate.component?.name ? normalizeContextToken(candidate.component.name) : "";
  if (componentToken) {
    add(toPascalCase(splitWords(componentToken)));
  }

  if (roleToken && significant.length > 0) add(`${roleToken}${toPascalCase(significant)}`);
  if (componentToken && roleToken) add(`${toPascalCase(splitWords(componentToken))}${roleToken}`);
  if (componentToken && significant.length > 0) add(`${toPascalCase(splitWords(componentToken))}${toPascalCase(significant)}`);

  return suffixes;
}

function resolveKeyWithContext(
  candidate: RawCandidate,
  baseKey: string,
  localeSnapshot: LocaleSnapshot,
  proposedEnEntriesAccumulator: Record<string, string>,
  usedKeysThisFile: Map<string, string>,
): {
  key?: string;
  unresolvedReason?: string;
  collisionKey?: string;
  collisionValue?: string;
} {
  const attempts = [baseKey, ...deriveContextualSuffixes(candidate, baseKey).map((suffix) => `${baseKey}${suffix}`)];

  for (const candidateKey of attempts) {
    const plannedValue = usedKeysThisFile.get(candidateKey) ?? proposedEnEntriesAccumulator[candidateKey];
    if (plannedValue !== undefined && plannedValue !== candidate.text) {
      continue;
    }
    const existingCheck = checkKeyAgainstSnapshot(localeSnapshot, candidateKey, candidate.text);
    if (existingCheck.collision) {
      continue;
    }
    return { key: candidateKey };
  }

  const snapshotCollisionKey = attempts.find((attempt) => localeSnapshot.enEntries[attempt] !== undefined);
  if (snapshotCollisionKey) {
    return {
      unresolvedReason: `could not derive a unique contextual key for base "${baseKey}" after deterministic retries`,
      collisionKey: snapshotCollisionKey,
      collisionValue: localeSnapshot.enEntries[snapshotCollisionKey],
    };
  }
  return { unresolvedReason: `could not derive a unique contextual key for base "${baseKey}" after deterministic retries` };
}

/** Build the proposed `t(...)` call text for a non-JSX-text usage (already inside an expression context: conditional branch, call argument, or bare JSX expression). */
function buildTCall(key: string, interpolation: Record<string, string> | undefined): string {
  if (!interpolation || Object.keys(interpolation).length === 0) return `t("${key}")`;
  const props = Object.entries(interpolation)
    .map(([name, expr]) => (name === expr ? name : `${name}: ${expr}`))
    .join(", ");
  return `t("${key}", { ${props} })`;
}

function collectRawCandidates(sourceFile: ts.SourceFile): RawCandidate[] {
  const candidates: RawCandidate[] = [];
  const lineOf = (pos: number) => sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
  // Nodes already consumed by a more specific candidate (e.g. a conditional's
  // branches, or a message-setter call's argument) must not also be
  // re-collected by the generic bare-template-literal visitor below.
  const consumedNodes = new WeakSet<ts.Node>();

  function visit(node: ts.Node) {
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      const tagName = jsxTagName(node);
      const textChildren = node.children.filter(
        (child): child is ts.JsxText => ts.isJsxText(child) && isMeaningfulJsxText(child.text),
      );
      const hasMixedStructure = node.children.some((child) => !ts.isJsxText(child));
      const isSafeTag = !!tagName && (SAFE_TEXT_TAGS.has(tagName) || SAFE_TEXT_CONTAINER_TAGS.has(tagName));

      if (!hasMixedStructure && textChildren.length > 0 && isSafeTag) {
        for (const child of textChildren) {
          const trimmed = child.text.replace(/\s+/g, " ").trim();
          if (isPunctuationOnly(trimmed)) continue;
          candidates.push({
            node: child,
            kind: "JSX_TEXT",
            tagOrProp: tagName!,
            text: trimmed,
            line: lineOf(child.getStart()),
            component: getEnclosingComponent(child),
          });
        }
      } else if (hasMixedStructure && textChildren.length > 0 && isSafeTag) {
        // Fragmented JSX: static text leads, trails, or is interleaved with
        // nested elements/expressions. Conservatively restrict transformable
        // fragmentation to the simplest, unambiguous shape: exactly ONE
        // non-text child (a single nested element or expression) with
        // static text only leading and/or trailing it — never in the middle,
        // and never alongside multiple nested children/expressions. Richer
        // shapes (e.g. multiple interleaved expressions) remain SPECIAL_HANDLING.
        const nonTextChildren = node.children.filter((child) => !ts.isJsxText(child));
        const isSimpleWrap =
          nonTextChildren.length === 1 &&
          textChildren.length <= 2 &&
          (() => {
            const nonTextIndex = node.children.indexOf(nonTextChildren[0]!);
            return textChildren.every((child) => {
              const idx = node.children.indexOf(child);
              return idx < nonTextIndex || idx > nonTextIndex;
            });
          })();
        if (isSimpleWrap) {
          const nonTextChild = nonTextChildren[0]!;
          const nonTextIndex = node.children.indexOf(nonTextChild);
          const leadingText = textChildren
            .filter((child) => node.children.indexOf(child) < nonTextIndex)
            .map((child) => child.text)
            .join(" ");
          const trailingText = textChildren
            .filter((child) => node.children.indexOf(child) > nonTextIndex)
            .map((child) => child.text)
            .join(" ");
          const leadingNormalized = normalizeWhitespace(leadingText);
          const trailingNormalized = normalizeWhitespace(trailingText);

          // Single-expression wrapped sentence/phrase: convert to ONE
          // interpolated translation unit so translators can reorder naturally.
          if (
            ts.isJsxExpression(nonTextChild) &&
            !!nonTextChild.expression &&
            leadingNormalized.length > 0 &&
            trailingNormalized.length > 0
          ) {
            const expression = nonTextChild.expression;
            const interpolationName = deriveInterpolationName(expression);
            const interpolation = { [interpolationName]: expression.getText() };
            const phrase = normalizeWhitespace(`${leadingNormalized} {{${interpolationName}}} ${trailingNormalized}`);
            if (!isPunctuationOnly(phrase) && /[A-Za-z]{2,}/.test(phrase)) {
              candidates.push({
                node: nonTextChild,
                kind: "JSX_FRAGMENT_INTERPOLATED",
                tagOrProp: tagName!,
                text: phrase,
                line: lineOf(nonTextChild.getStart()),
                component: getEnclosingComponent(nonTextChild),
                interpolation,
              });
            }
          } else {
            for (const child of textChildren) {
              const trimmed = normalizeWhitespace(child.text);
              if (isPunctuationOnly(trimmed)) continue;
              candidates.push({
                node: child,
                kind: "JSX_FRAGMENT_TEXT",
                tagOrProp: tagName!,
                text: trimmed,
                line: lineOf(child.getStart()),
                component: getEnclosingComponent(child),
              });
            }
          }
        } else {
          // Conservative direct-text-child handling for multi-child fragments:
          // if there is exactly one standalone static text child, and it is
          // placed entirely before or after all nested children, treat only
          // that child as transformable. Interleaved/multi-text grammar stays
          // SPECIAL_HANDLING.
          const canPromoteStandaloneDirectText =
            nonTextChildren.length > 1 &&
            textChildren.length === 1 &&
            (() => {
              const textIndex = node.children.indexOf(textChildren[0]!);
              const firstNonText = node.children.indexOf(nonTextChildren[0]!);
              const lastNonText = node.children.indexOf(nonTextChildren[nonTextChildren.length - 1]!);
              return textIndex < firstNonText || textIndex > lastNonText;
            })();
          if (canPromoteStandaloneDirectText) {
            const textChild = textChildren[0]!;
            const trimmed = normalizeWhitespace(textChild.text);
            if (!isPunctuationOnly(trimmed) && /[A-Za-z]{2,}/.test(trimmed)) {
              candidates.push({
                node: textChild,
                kind: "JSX_FRAGMENT_TEXT",
                tagOrProp: tagName!,
                text: trimmed,
                line: lineOf(textChild.getStart()),
                component: getEnclosingComponent(textChild),
              });
            }
          }
        }
      }
    }

    if (ts.isJsxAttribute(node)) {
      const propName = node.name.getText();
      const init = node.initializer;
      if (init && ts.isStringLiteral(init)) {
        const tagName = enclosingTagName(node);
        const isSafeNative = isNativeElementTag(tagName) && ALLOWED_TEXT_PROPS.has(propName);
        const customKey = !isNativeElementTag(tagName) ? `${tagName}.${propName}` : undefined;
        const isSafeCustom = customKey && KNOWN_CUSTOM_SAFE_TEXT_PROPS.has(customKey);
        if (isSafeNative || isSafeCustom) {
          candidates.push({
            node: init,
            kind: "JSX_ATTRIBUTE",
            tagOrProp: propName,
            text: init.text,
            line: lineOf(init.getStart()),
            component: getEnclosingComponent(init),
          });
        }
      }
    }

    // CONDITIONAL_STRING: `cond ? "A" : "B"` where both branches are simple
    // text (string literal / no-substitution template / template
    // expression). Each branch becomes its own splice target so the
    // condition expression itself is never touched.
    if (ts.isConditionalExpression(node)) {
      const isSimpleBranch = (n: ts.Expression): n is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | ts.TemplateExpression =>
        ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n);
      if (isSimpleBranch(node.whenTrue) && isSimpleBranch(node.whenFalse) && !isConditionalTechnicalContextLocal(node)) {
        const branches: Array<ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | ts.TemplateExpression> = [
          node.whenTrue,
          node.whenFalse,
        ];
        let allBranchesUserFacing = true;
        for (const branch of branches) {
          if (ts.isTemplateExpression(branch)) {
            if (isTechnicalTemplateContextLocal(branch) || !templateLooksUserFacingLocal(branch)) {
              allBranchesUserFacing = false;
              break;
            }
          } else if (isPunctuationOnly(branch.text) || !/[A-Za-z]{2,}/.test(branch.text)) {
            allBranchesUserFacing = false;
            break;
          }
        }
        if (allBranchesUserFacing) {
          for (const branch of branches) {
            const { enValue, interpolation } = extractLiteralOrTemplateValue(branch);
            candidates.push({
              node: branch,
              kind: "CONDITIONAL_STRING",
              tagOrProp: "conditional",
              text: enValue,
              line: lineOf(branch.getStart()),
              component: getEnclosingComponent(branch),
              interpolation,
            });
            consumedNodes.add(branch);
          }
        }
      }
    }

    // MESSAGE_SETTER_ARGUMENT: `setXMessage("...")` / `setXMessage(`...${expr}...`)`.
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee) && UI_MESSAGE_SETTER_NAME_PATTERN.test(callee.text)) {
        const arg = node.arguments[0];
        if (arg && !consumedNodes.has(arg)) {
          if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
            if (!isPunctuationOnly(arg.text) && /[A-Za-z]{2,}/.test(arg.text)) {
              candidates.push({
                node: arg,
                kind: "MESSAGE_SETTER_ARGUMENT",
                tagOrProp: callee.text,
                text: arg.text,
                line: lineOf(arg.getStart()),
                component: getEnclosingComponent(arg),
              });
              consumedNodes.add(arg);
            }
          } else if (ts.isTemplateExpression(arg)) {
            if (!isTechnicalTemplateContextLocal(arg) && templateLooksUserFacingLocal(arg)) {
              const { enValue, interpolation } = extractTemplateInterpolation(arg);
              candidates.push({
                node: arg,
                kind: "MESSAGE_SETTER_ARGUMENT",
                tagOrProp: callee.text,
                text: enValue,
                line: lineOf(arg.getStart()),
                component: getEnclosingComponent(arg),
                interpolation,
              });
              consumedNodes.add(arg);
            }
          }
        }
      }
    }

    // Bare TEMPLATE_LITERAL: an interpolated template used directly as the
    // sole JSX expression child of a known-safe tag, e.g. `<p>{`Hi ${name}`}</p>`.
    // Conservative on purpose — only this one well-defined shape, matching
    // the "JSX whole-string text" analog for interpolated content.
    if (ts.isTemplateExpression(node) && !consumedNodes.has(node)) {
      const parent = node.parent;
      if (ts.isJsxExpression(parent) && (ts.isJsxElement(parent.parent) || ts.isJsxFragment(parent.parent))) {
        const owner = parent.parent;
        const tagName = jsxTagName(owner);
        const isSafeTag = !!tagName && (SAFE_TEXT_TAGS.has(tagName) || SAFE_TEXT_CONTAINER_TAGS.has(tagName));
        if (isSafeTag && !isTechnicalTemplateContextLocal(node) && templateLooksUserFacingLocal(node)) {
          const { enValue, interpolation } = extractTemplateInterpolation(node);
          candidates.push({
            node,
            kind: "TEMPLATE_LITERAL",
            tagOrProp: tagName!,
            text: enValue,
            line: lineOf(node.getStart()),
            component: getEnclosingComponent(node),
            interpolation,
          });
          consumedNodes.add(node);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return candidates;
}

/** Detect an existing `import { useTranslation } from "react-i18next"` in the file. */
function findExistingReactI18nextImport(sourceFile: ts.SourceFile): ts.ImportDeclaration | undefined {
  return sourceFile.statements.find(
    (s): s is ts.ImportDeclaration =>
      ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier) && s.moduleSpecifier.text === "react-i18next",
  );
}

function importHasUseTranslation(importDecl: ts.ImportDeclaration): boolean {
  const clause = importDecl.importClause;
  if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings)) return false;
  return clause.namedBindings.elements.some((el) => el.name.text === "useTranslation");
}

/** Find an existing `const { t } = useTranslation("ns")` (or `const { t, ... }`) call inside a component body for the given namespace. */
function findExistingHookCall(body: ts.Block, namespace: string): ts.VariableStatement | undefined {
  for (const stmt of body.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (
        decl.initializer &&
        ts.isCallExpression(decl.initializer) &&
        ts.isIdentifier(decl.initializer.expression) &&
        decl.initializer.expression.text === "useTranslation" &&
        decl.initializer.arguments[0] &&
        ts.isStringLiteral(decl.initializer.arguments[0] as ts.StringLiteral) &&
        (decl.initializer.arguments[0] as ts.StringLiteral).text === namespace
      ) {
        return stmt;
      }
    }
  }
  return undefined;
}

/**
 * Plan (in memory only) the SAFE_AUTO transformation for a single file.
 * `localeSnapshot` is read-only state used for key reuse/collision detection.
 */
export function planFileTransform(
  loaded: LoadedSourceFile,
  namespace: string,
  localeSnapshot: LocaleSnapshot,
  proposedEnEntriesAccumulator: Record<string, string>,
  collisionsAccumulator: TransformPlan["keyCollisions"],
): FileTransformPlan {
  const { filePath, sourceFile } = loaded;
  const originalText = fs.readFileSync(filePath, "utf8");
  const candidates = collectRawCandidates(sourceFile);

  const usedKeysThisFile = new Map<string, string>(); // key -> englishValue already assigned in this plan
  const changes: PlannedChange[] = [];

  for (const candidate of candidates) {
    const baseKey = generateKeyCandidate(candidate.text, {
      tagName:
        candidate.kind === "JSX_TEXT" ||
        candidate.kind === "JSX_FRAGMENT_TEXT" ||
        candidate.kind === "JSX_FRAGMENT_INTERPOLATED" ||
        candidate.kind === "TEMPLATE_LITERAL"
          ? candidate.tagOrProp
          : undefined,
      propName: candidate.kind === "JSX_ATTRIBUTE" ? candidate.tagOrProp : undefined,
    });

    // Reuse an existing key with the exact same English value, if present.
    const existingKeyForValue = findExistingKeyForValue(localeSnapshot, candidate.text) ?? Object.entries(proposedEnEntriesAccumulator).find(([, v]) => v === candidate.text)?.[0];

    let key = existingKeyForValue ?? baseKey;
    let reusedExistingKey = existingKeyForValue !== undefined;
    let collision = false;
    let transformable = true;
    let skipReason: string | undefined;

    if (!reusedExistingKey) {
      const resolved = resolveKeyWithContext(candidate, baseKey, localeSnapshot, proposedEnEntriesAccumulator, usedKeysThisFile);
      if (resolved.key) {
        key = resolved.key;
      } else {
        collision = true;
        transformable = false;
        skipReason = resolved.unresolvedReason;
        if (resolved.collisionKey && resolved.collisionValue) {
          collisionsAccumulator.push({
            key: resolved.collisionKey,
            existingValue: resolved.collisionValue,
            newValue: candidate.text,
            filePath,
            line: candidate.line,
          });
        }
      }
    }

    if (transformable) {
      usedKeysThisFile.set(key, candidate.text);
      proposedEnEntriesAccumulator[key] = candidate.text;
    }

    const proposedUsage =
      candidate.kind === "JSX_TEXT" ||
      candidate.kind === "JSX_FRAGMENT_TEXT" ||
      candidate.kind === "JSX_FRAGMENT_INTERPOLATED" ||
      candidate.kind === "TEMPLATE_LITERAL"
        ? `{${buildTCall(key, candidate.interpolation)}}`
        : candidate.kind === "JSX_ATTRIBUTE"
          ? `{${buildTCall(key, candidate.interpolation)}}`
          : buildTCall(key, candidate.interpolation); // CONDITIONAL_STRING / MESSAGE_SETTER_ARGUMENT: bare t(...) inside an existing expression context

    changes.push({
      filePath,
      line: candidate.line,
      kind: candidate.kind,
      tagOrProp: candidate.tagOrProp,
      englishValue: candidate.text,
      key,
      reusedExistingKey,
      collision,
      proposedUsage,
      transformable,
      skipReason,
      interpolation: candidate.interpolation,
    });
  }

  // --- Hook/import planning -------------------------------------------------
  const hookPlans: HookPlan[] = [];
  const componentsNeedingHook = new Map<string, { name: string; body: ts.Block | undefined }>();
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i]!;
    const change = changes[i]!;
    if (!change.transformable) continue;
    if (!candidate.component) {
      // No enclosing component found — hook placement is ambiguous; downgrade this change.
      change.transformable = false;
      change.skipReason = "could not determine an enclosing component function for useTranslation() hook placement";
      continue;
    }
    componentsNeedingHook.set(candidate.component.name, candidate.component);
  }

  const existingImport = findExistingReactI18nextImport(sourceFile);
  const needsNewImport = !existingImport || !importHasUseTranslation(existingImport);

  for (const [name, component] of componentsNeedingHook) {
    const existingHook = component.body ? findExistingHookCall(component.body, namespace) : undefined;
    hookPlans.push({
      filePath,
      componentName: name,
      needsImport: needsNewImport,
      needsHook: !existingHook,
      detail: existingHook
        ? `reusing existing const { t } = useTranslation("${namespace}") in ${name}`
        : `inserting const { t } = useTranslation("${namespace}") at top of ${name}`,
    });
  }

  // --- Build proposed full-file text (in memory only) -----------------------
  const proposedText = buildProposedText(originalText, sourceFile, changes, componentsNeedingHook, namespace, existingImport, needsNewImport);
  const validation = validateSourceText(filePath, proposedText);

  // If validation fails, conservatively mark every change in this file as non-transformable
  // rather than proposing a source rewrite that could not be safely re-parsed.
  if (!validation.valid) {
    for (const change of changes) {
      if (change.transformable) {
        change.transformable = false;
        change.skipReason = "proposed file text failed re-parse validation; transformation withheld for this file";
      }
    }
  }

  return { filePath, namespace, changes, hookPlans, proposedText, originalText, validation };
}

/** Splice all transformable changes + hook/import insertions into the original text, purely as an in-memory string. */
function buildProposedText(
  originalText: string,
  sourceFile: ts.SourceFile,
  changes: PlannedChange[],
  componentsNeedingHook: Map<string, { name: string; body: ts.Block | undefined }>,
  namespace: string,
  existingImport: ts.ImportDeclaration | undefined,
  needsNewImport: boolean,
): string {
  type Splice = { start: number; end: number; replacement: string };
  const splices: Splice[] = [];

  // JSX text/attribute replacements, only for transformable changes, matched by node position.
  // We re-walk to get exact node start/end (text-only splicing keeps this module decoupled from classifier internals).
  function visit(node: ts.Node) {
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      const tagName = jsxTagName(node);
      const isSafeTag = !!tagName && (SAFE_TEXT_TAGS.has(tagName) || SAFE_TEXT_CONTAINER_TAGS.has(tagName));
      if (isSafeTag) {
        const nonTextChildren = node.children.filter((child) => !ts.isJsxText(child));
        if (
          nonTextChildren.length === 1 &&
          ts.isJsxExpression(nonTextChildren[0]) &&
          nonTextChildren[0].expression
        ) {
          const exprNode = nonTextChildren[0];
          const expression = exprNode.expression!;
          const exprIndex = node.children.indexOf(exprNode);
          const leadingText = node.children
            .filter((child): child is ts.JsxText => ts.isJsxText(child) && isMeaningfulJsxText(child.text))
            .filter((child) => node.children.indexOf(child) < exprIndex)
            .map((child) => child.text)
            .join(" ");
          const trailingText = node.children
            .filter((child): child is ts.JsxText => ts.isJsxText(child) && isMeaningfulJsxText(child.text))
            .filter((child) => node.children.indexOf(child) > exprIndex)
            .map((child) => child.text)
            .join(" ");
          const leadingNormalized = normalizeWhitespace(leadingText);
          const trailingNormalized = normalizeWhitespace(trailingText);
          if (leadingNormalized.length > 0 && trailingNormalized.length > 0) {
            const interpolationName = deriveInterpolationName(expression);
            const phrase = normalizeWhitespace(`${leadingNormalized} {{${interpolationName}}} ${trailingNormalized}`);
            const line = sourceFile.getLineAndCharacterOfPosition(exprNode.getStart()).line + 1;
            const match = changes.find(
              (c) => c.kind === "JSX_FRAGMENT_INTERPOLATED" && c.transformable && c.line === line && c.englishValue === phrase,
            );
            if (match) {
              const meaningfulChildren = node.children.filter(
                (child) => !ts.isJsxText(child) || isMeaningfulJsxText(child.text),
              );
              if (meaningfulChildren.length > 0) {
                splices.push({
                  start: meaningfulChildren[0]!.getStart(),
                  end: meaningfulChildren[meaningfulChildren.length - 1]!.getEnd(),
                  replacement: match.proposedUsage,
                });
              }
            }
          }
        }
      }
    }
    if (ts.isJsxText(node)) {
      const trimmed = node.text.replace(/\s+/g, " ").trim();
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      const match = changes.find(
        (c) => (c.kind === "JSX_TEXT" || c.kind === "JSX_FRAGMENT_TEXT") && c.transformable && c.line === line && c.englishValue === trimmed,
      );
      if (match) {
        splices.push({ start: node.getStart(), end: node.getEnd(), replacement: match.proposedUsage });
      }
    }
    if (ts.isStringLiteral(node) && ts.isJsxAttribute(node.parent) && node.parent.initializer === node) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      const match = changes.find((c) => c.kind === "JSX_ATTRIBUTE" && c.transformable && c.line === line && c.englishValue === node.text);
      if (match) {
        splices.push({ start: node.getStart(), end: node.getEnd(), replacement: match.proposedUsage });
      }
    }

    // CONDITIONAL_STRING: replace each simple-text branch of the conditional
    // in place with a bare `t(...)`/`t(..., {...})` call, leaving the
    // condition and surrounding expression untouched.
    if (ts.isConditionalExpression(node)) {
      for (const branch of [node.whenTrue, node.whenFalse]) {
        if (!ts.isStringLiteral(branch) && !ts.isNoSubstitutionTemplateLiteral(branch) && !ts.isTemplateExpression(branch)) continue;
        const line = sourceFile.getLineAndCharacterOfPosition(branch.getStart()).line + 1;
        const { enValue } = extractLiteralOrTemplateValue(branch);
        const match = changes.find((c) => c.kind === "CONDITIONAL_STRING" && c.transformable && c.line === line && c.englishValue === enValue);
        if (match) {
          splices.push({ start: branch.getStart(), end: branch.getEnd(), replacement: match.proposedUsage });
        }
      }
    }

    // MESSAGE_SETTER_ARGUMENT: replace the call's sole/first string or
    // template-literal argument in place with a bare `t(...)` call.
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee) && UI_MESSAGE_SETTER_NAME_PATTERN.test(callee.text)) {
        const arg = node.arguments[0];
        if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg) || ts.isTemplateExpression(arg))) {
          const line = sourceFile.getLineAndCharacterOfPosition(arg.getStart()).line + 1;
          const { enValue } = extractLiteralOrTemplateValue(arg);
          const match = changes.find(
            (c) => c.kind === "MESSAGE_SETTER_ARGUMENT" && c.transformable && c.line === line && c.englishValue === enValue,
          );
          if (match) {
            splices.push({ start: arg.getStart(), end: arg.getEnd(), replacement: match.proposedUsage });
          }
        }
      }
    }

    // Bare TEMPLATE_LITERAL used directly as a JSX expression child.
    if (ts.isTemplateExpression(node)) {
      const parent = node.parent;
      if (ts.isJsxExpression(parent) && (ts.isJsxElement(parent.parent) || ts.isJsxFragment(parent.parent))) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        const { enValue } = extractTemplateInterpolation(node);
        const match = changes.find((c) => c.kind === "TEMPLATE_LITERAL" && c.transformable && c.line === line && c.englishValue === enValue);
        if (match) {
          splices.push({ start: node.getStart(), end: node.getEnd(), replacement: match.proposedUsage });
        }
      }
    }

    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  // Hook insertions: at the start of each component body that needs one and doesn't already have it.
  for (const [, component] of componentsNeedingHook) {
    if (!component.body) continue;
    const alreadyHas = findExistingHookCall(component.body, namespace);
    if (alreadyHas) continue;
    const insertPos = component.body.getStart() + 1; // just after the opening "{"
    splices.push({
      start: insertPos,
      end: insertPos,
      replacement: `\n  const { t } = useTranslation("${namespace}");`,
    });
  }

  // Import insertion/augmentation.
  if (needsNewImport) {
    if (existingImport) {
      // Augment existing `import { X } from "react-i18next"` with useTranslation.
      const clause = existingImport.importClause;
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.length > 0) {
        const lastElement = clause.namedBindings.elements[clause.namedBindings.elements.length - 1]!;
        splices.push({ start: lastElement.getEnd(), end: lastElement.getEnd(), replacement: ", useTranslation" });
      }
    } else {
      // Insert a new top-level import after the last existing import statement (or at file start).
      const lastImport = [...sourceFile.statements].reverse().find((s) => ts.isImportDeclaration(s));
      const insertPos = lastImport ? lastImport.getEnd() : 0;
      splices.push({
        start: insertPos,
        end: insertPos,
        replacement: `${lastImport ? "\n" : ""}import { useTranslation } from "react-i18next";${lastImport ? "" : "\n"}`,
      });
    }
  }

  splices.sort((a, b) => a.start - b.start);
  let result = "";
  let cursor = 0;
  for (const splice of splices) {
    if (splice.start < cursor) continue; // overlapping splice guard (should not happen given distinct node positions)
    result += originalText.slice(cursor, splice.start);
    result += splice.replacement;
    cursor = splice.end;
  }
  result += originalText.slice(cursor);
  return result;
}

export interface PlanFeatureOptions {
  featureDir: string;
  namespace: string;
  localesRoot: string;
  files: LoadedSourceFile[];
}

/** Plan the full SAFE_AUTO transformation for every loaded file under a feature. */
export function planFeatureTransform(options: PlanFeatureOptions): TransformPlan {
  const localeSnapshotBefore = loadLocaleSnapshot(options.localesRoot, options.namespace);
  const proposedEnEntries: Record<string, string> = {};
  const keyCollisions: TransformPlan["keyCollisions"] = [];

  const files = options.files.map((loaded) =>
    planFileTransform(loaded, options.namespace, localeSnapshotBefore, proposedEnEntries, keyCollisions),
  );

  return { namespace: options.namespace, files, localeSnapshotBefore, proposedEnEntries, keyCollisions };
}

export { missingPtBrKeys };
