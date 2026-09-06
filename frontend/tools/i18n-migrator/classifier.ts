/**
 * Candidate detection + Phase 1 classification.
 *
 * Walks each loaded source file's AST and produces Findings (candidates) and
 * ExcludedStrings (structurally technical strings). Detection favors AST
 * context over regex-on-text heuristics; see exclusions.ts.
 */
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
import {
  checkValueShapeExclusion,
  isCaseClauseExpression,
  isComparisonOperand,
  isDeniedTechnicalPropName,
  isIntlConstructorArgument,
  isLiteralTypeMember,
  isModuleSpecifier,
} from "./exclusions";
import type { LoadedSourceFile } from "./scanner";
import type { ExcludedString, Finding } from "./types";

export interface ClassifyResult {
  findings: Finding[];
  excluded: ExcludedString[];
}

function lineOf(sourceFile: ts.SourceFile, pos: number): number {
  return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
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

function isNativeElementTag(tagName: string | undefined): boolean {
  return !!tagName && /^[a-z]/.test(tagName);
}

function isMeaningfulJsxText(text: string): boolean {
  return text.replace(/\s+/g, " ").trim().length > 0;
}

function hasVisibleWordCharacters(text: string): boolean {
  return /[A-Za-z0-9]/.test(text);
}

function findAncestor<T extends ts.Node>(node: ts.Node, predicate: (ancestor: ts.Node) => ancestor is T): T | undefined {
  let current = node.parent;
  while (current) {
    if (predicate(current)) return current;
    current = current.parent;
  }
  return undefined;
}

function getJsxAttributeAncestor(node: ts.Node): ts.JsxAttribute | undefined {
  return findAncestor(node, ts.isJsxAttribute);
}

function isTechnicalJsxAttribute(propName: string, tagName: string | undefined): boolean {
  if (isDeniedTechnicalPropName(propName)) return true;
  return Boolean(tagName && isNativeElementTag(tagName) && NATIVE_ELEMENT_TECHNICAL_PROPS.has(propName));
}

function safeCustomTextKey(tagName: string | undefined, propName: string): string | undefined {
  if (!tagName || isNativeElementTag(tagName)) return undefined;
  const key = `${tagName}.${propName}`;
  return KNOWN_CUSTOM_SAFE_TEXT_PROPS.has(key) ? key : undefined;
}

function templateRawText(node: ts.TemplateExpression): string {
  return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join("");
}

function isTechnicalTemplateContext(node: ts.TemplateExpression): string | undefined {
  const jsxAttr = getJsxAttributeAncestor(node);
  if (jsxAttr) {
    const propName = jsxAttr.name.getText();
    const tagName = enclosingTagName(jsxAttr);
    if (isTechnicalJsxAttribute(propName, tagName)) {
      return `technical JSX attribute "${propName}"${tagName ? ` on <${tagName}>` : ""}`;
    }
  }

  const raw = templateRawText(node).trim();
  if (!raw) return "empty template literal";
  if (raw.startsWith("/") && !raw.includes(" ")) return "looks like a route/API path";
  if (/^https?:\/\//.test(raw)) return "looks like a URL";
  if (/^\s*(-H\b|curl\b)/.test(raw) || raw.includes('"X-Tenant-ID:') || raw.includes("curl -i")) return "looks like curl/header construction";
  if (raw.includes("px-") || raw.includes("py-") || raw.includes("bg-") || raw.includes("text-") || raw.includes("border-") || raw.includes("rounded-") || raw.includes("shadow-") || raw.includes("grid") || raw.includes("flex")) {
    return "looks like className/style construction";
  }
  return undefined;
}

function templateLooksUserFacing(node: ts.TemplateExpression): boolean {
  return /[A-Za-z]{2,}/.test(templateRawText(node));
}

function isSimpleTextBranch(node: ts.Expression): boolean {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node);
}

/** Punctuation/symbol-only text (no letters or digits) — never a translation candidate on its own. */
function isPunctuationOnly(text: string): boolean {
  return !hasVisibleWordCharacters(text);
}

/** Human-readable heuristic: has at least one run of letters that looks like a word, not just an identifier/code fragment. */
function looksHumanReadable(text: string): boolean {
  if (!/[A-Za-z]{2,}/.test(text)) return false;
  const trimmed = text.trim();
  // Reject CSS-class-like / identifier-like tokens (e.g. "px-4", "bg-red-500", "my_var", "some.path").
  if (/^[a-z][a-z0-9]*([-_.][a-z0-9]+)+$/i.test(trimmed)) return false;
  // Reject space-separated Tailwind-style className strings (e.g. "bg-amber-100 text-amber-800").
  if (/^([a-z0-9]+(-[a-z0-9]+)*\s*)+$/i.test(trimmed) && /-/.test(trimmed) && !/[.!?,]/.test(trimmed)) {
    const tokens = trimmed.split(/\s+/);
    if (tokens.every((t) => /^[a-z0-9]+(-[a-z0-9]+)*$/i.test(t))) return false;
  }
  return true;
}

/** Find the nearest enclosing function-like declaration/expression, if any. */
function getEnclosingFunctionLike(node: ts.Node): ts.FunctionLikeDeclaration | undefined {
  return findAncestor(node, (n): n is ts.FunctionLikeDeclaration =>
    ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n),
  );
}

/** Heuristic: does this function look like it returns/renders JSX (a component), rather than being a plain helper? */
function functionLooksLikeComponent(fn: ts.FunctionLikeDeclaration): boolean {
  const name = ts.isFunctionDeclaration(fn) && fn.name ? fn.name.text : undefined;
  if (name && /^[A-Z]/.test(name)) return true;
  // Arrow function assigned to a capitalized const, e.g. `const Foo = () => ...`.
  if (ts.isArrowFunction(fn) && ts.isVariableDeclaration(fn.parent) && ts.isIdentifier(fn.parent.name)) {
    if (/^[A-Z]/.test(fn.parent.name.text)) return true;
  }
  return false;
}

function isSimpleStringConditional(node: ts.ConditionalExpression): boolean {
  return isSimpleTextBranch(node.whenTrue) && isSimpleTextBranch(node.whenFalse);
}

function isConditionalTechnicalContext(node: ts.ConditionalExpression): string | undefined {
  const jsxAttr = getJsxAttributeAncestor(node);
  if (!jsxAttr) return undefined;
  const propName = jsxAttr.name.getText();
  const tagName = enclosingTagName(jsxAttr);
  if (isTechnicalJsxAttribute(propName, tagName)) {
    return `technical JSX attribute "${propName}"${tagName ? ` on <${tagName}>` : ""}`;
  }
  return undefined;
}

/** Classify+collect candidates for a single loaded source file. */
export function classifySourceFile({ filePath, sourceFile }: LoadedSourceFile): ClassifyResult {
  const findings: Finding[] = [];
  const excluded: ExcludedString[] = [];
  const handledConditionals = new WeakSet<ts.ConditionalExpression>();
  const handledStringLiterals = new WeakSet<ts.StringLiteralLike>();
  const handledTemplateExpressions = new WeakSet<ts.TemplateExpression>();

  function addExcluded(node: ts.Node, text: string, reason: string) {
    excluded.push({ filePath, line: lineOf(sourceFile, node.getStart()), text, reason });
  }

  function visit(node: ts.Node) {
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      visitJsxChildren(node);
    }

    if (ts.isJsxAttribute(node)) {
      visitJsxAttribute(node);
    }

    if (ts.isConditionalExpression(node)) {
      visitConditionalExpression(node);
    }

    if (ts.isTemplateExpression(node)) {
      visitTemplateExpression(node);
    }

    if (ts.isPropertyAssignment(node)) {
      visitObjectProperty(node);
    }

    if (ts.isObjectLiteralExpression(node)) {
      visitObjectLiteralAsDisplayMap(node);
    }

    if (ts.isReturnStatement(node)) {
      visitReturnStatement(node);
    }

    if (ts.isCallExpression(node)) {
      visitCallExpression(node);
    }

    if (ts.isStringLiteralLike(node) && !ts.isNoSubstitutionTemplateLiteral(node)) {
      visitBareStringLiteral(node);
    }

    ts.forEachChild(node, visit);
  }

  function visitJsxChildren(node: ts.JsxElement | ts.JsxFragment) {
    const tagName = jsxTagName(node);
    const textChildren = node.children.filter((child): child is ts.JsxText => ts.isJsxText(child) && isMeaningfulJsxText(child.text));
    if (textChildren.length === 0) return;

    const hasMixedStructure = node.children.some((child) => !ts.isJsxText(child));
    if (hasMixedStructure) {
      findings.push({
        filePath,
        line: lineOf(sourceFile, textChildren[0]!.getStart()),
        text: node.getText(),
        category: "JSX_TEXT",
        classification: "SPECIAL_HANDLING",
        reason: "fragmented user-facing JSX text around expressions or nested elements",
        context: tagName,
      });
      return;
    }

    for (const child of textChildren) {
      const trimmed = child.text.replace(/\s+/g, " ").trim();
      if (isPunctuationOnly(trimmed)) {
        addExcluded(child, trimmed, `static text inside <${tagName ?? "fragment"}> is punctuation or symbol-only`);
        continue;
      }

      if (tagName && TECHNICAL_DISPLAY_TAGS.has(tagName)) {
        findings.push({
          filePath,
          line: lineOf(sourceFile, child.getStart()),
          text: trimmed,
          category: "JSX_TEXT",
          classification: "MANUAL_REVIEW",
          reason: `text inside <${tagName}> is a technical/code-display context; verify it is not an identifier or code fragment before translating`,
          context: tagName,
        });
        continue;
      }

      if (tagName && (SAFE_TEXT_TAGS.has(tagName) || SAFE_TEXT_CONTAINER_TAGS.has(tagName))) {
        findings.push({
          filePath,
          line: lineOf(sourceFile, child.getStart()),
          text: trimmed,
          category: "JSX_TEXT",
          classification: "SAFE_AUTO",
          reason: `static text inside <${tagName}>`,
          context: tagName,
        });
      } else {
        findings.push({
          filePath,
          line: lineOf(sourceFile, child.getStart()),
          text: trimmed,
          category: "JSX_TEXT",
          classification: "MANUAL_REVIEW",
          reason: tagName
            ? `static text inside <${tagName}>, which is not on the known-safe tag list`
            : "static text inside a JSX fragment or unresolved element",
          context: tagName,
        });
      }
    }
  }

  function visitJsxAttribute(node: ts.JsxAttribute) {
    const propName = node.name.getText();
    const init = node.initializer;
    if (!init || !ts.isStringLiteral(init)) return;

    const text = init.text;
    const tagName = enclosingTagName(node);

    if (isTechnicalJsxAttribute(propName, tagName)) {
      addExcluded(init, text, `technical JSX attribute "${propName}"${tagName ? ` on <${tagName}>` : ""}`);
      return;
    }

    if (isNativeElementTag(tagName) && ALLOWED_TEXT_PROPS.has(propName)) {
      findings.push({
        filePath,
        line: lineOf(sourceFile, init.getStart()),
        text,
        category: "JSX_ATTRIBUTE",
        classification: "SAFE_AUTO",
        reason: `allow-listed user-facing prop "${propName}"`,
        context: propName,
      });
      return;
    }

    const customSafeKey = safeCustomTextKey(tagName, propName);
    if (customSafeKey) {
      findings.push({
        filePath,
        line: lineOf(sourceFile, init.getStart()),
        text,
        category: "JSX_ATTRIBUTE",
        classification: "SAFE_AUTO",
        reason: `known-vetted custom display prop "${customSafeKey}"`,
        context: propName,
      });
      return;
    }

    if (!isNativeElementTag(tagName) && ALLOWED_TEXT_PROPS.has(propName)) {
      findings.push({
        filePath,
        line: lineOf(sourceFile, init.getStart()),
        text,
        category: "JSX_ATTRIBUTE",
        classification: "MANUAL_REVIEW",
        reason: `custom component prop "${propName}" is not a vetted safe combination`,
        context: propName,
      });
      return;
    }

    const shapeExclusion = checkValueShapeExclusion(text);
    if (shapeExclusion.excluded) {
      addExcluded(init, text, shapeExclusion.reason ?? "structural exclusion");
      return;
    }

    findings.push({
      filePath,
      line: lineOf(sourceFile, init.getStart()),
      text,
      category: "JSX_ATTRIBUTE",
      classification: "MANUAL_REVIEW",
      reason: `string prop "${propName}" is not on the allow-list or deny-list`,
      context: propName,
    });
  }

  function visitConditionalExpression(node: ts.ConditionalExpression) {
    if (handledConditionals.has(node)) return;
    if (!isSimpleStringConditional(node)) return;
    if (isConditionalTechnicalContext(node)) return;

    findings.push({
      filePath,
      line: lineOf(sourceFile, node.getStart()),
      text: node.getText(),
      category: "CONDITIONAL_STRING",
      classification: "SPECIAL_HANDLING",
      reason: "simple conditional user-facing text",
    });
    handledConditionals.add(node);
  }

  function visitTemplateExpression(node: ts.TemplateExpression) {
    if (handledTemplateExpressions.has(node)) return;
    const technicalReason = isTechnicalTemplateContext(node);
    if (technicalReason) {
      addExcluded(node, node.getText(), technicalReason);
      return;
    }

    if (!templateLooksUserFacing(node)) return;

    findings.push({
      filePath,
      line: lineOf(sourceFile, node.getStart()),
      text: node.getText(),
      category: "TEMPLATE_LITERAL",
      classification: "SPECIAL_HANDLING",
      reason: node.head.text.trim().length === 0 ? "interpolated user-facing text beginning with interpolation" : "interpolated user-facing text",
    });
  }

  function visitObjectProperty(node: ts.PropertyAssignment) {
    if (!ts.isStringLiteral(node.initializer)) return;
    if (!ts.isIdentifier(node.name) && !ts.isStringLiteral(node.name)) return;

    const propName = ts.isIdentifier(node.name) ? node.name.text : node.name.text;
    const text = node.initializer.text;

    if (isDeniedTechnicalPropName(propName)) {
      addExcluded(node.initializer, text, `technical object property "${propName}"`);
      return;
    }

    const shapeExclusion = checkValueShapeExclusion(text);
    if (shapeExclusion.excluded) {
      addExcluded(node.initializer, text, shapeExclusion.reason ?? "structural exclusion");
      return;
    }

    if (propName === "label") {
      findings.push({
        filePath,
        line: lineOf(sourceFile, node.initializer.getStart()),
        text,
        category: "OBJECT_PROPERTY",
        classification: "SPECIAL_HANDLING",
        reason: 'display label in a value/label style config object',
        context: propName,
      });
      return;
    }
  }

  const ENUM_CODE_KEY = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;
  const handledDisplayMapValues = new WeakSet<ts.StringLiteral>();

  /**
   * Detects plain `Record<string,string>`-shaped object literals whose keys
   * are enum/status codes and whose values are human-readable labels, e.g.:
   *
   *   const receiptStatusLabels = {
   *     PENDING_ISSUE: "Pending issue",
   *     ISSUED: "Issued",
   *   };
   *
   * Distinct from the value/label array-of-pairs pattern already handled by
   * visitObjectProperty's `label:` rule. Keys stay technical/excluded; values
   * become SPECIAL_HANDLING candidates when the whole object looks like a
   * consistent display-label map, or MANUAL_REVIEW when the shape is mixed
   * enough to be ambiguous.
   */
  function visitObjectLiteralAsDisplayMap(node: ts.ObjectLiteralExpression) {
    const properties = node.properties.filter((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p));
    if (properties.length < 2 || properties.length !== node.properties.length) return;

    const stringValueProps = properties.filter((p) => ts.isStringLiteral(p.initializer));
    if (stringValueProps.length !== properties.length) return; // not a uniform string-value map

    const entries = stringValueProps.map((p) => {
      const keyText = ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : undefined;
      const value = p.initializer as ts.StringLiteral;
      const keyIsEnumCode = !!keyText && ENUM_CODE_KEY.test(keyText);
      const valueIsHuman = looksHumanReadable(value.text) && !checkValueShapeExclusion(value.text).excluded;
      return { property: p, keyIsEnumCode, valueIsHuman, value };
    });

    const matchCount = entries.filter((e) => e.keyIsEnumCode && e.valueIsHuman).length;
    if (matchCount === 0) return; // does not look like a display-label map at all

    const isConsistentMap = matchCount === entries.length;

    for (const entry of entries) {
      if (!entry.valueIsHuman) continue;
      if (handledDisplayMapValues.has(entry.value)) continue;
      handledDisplayMapValues.add(entry.value);

      findings.push({
        filePath,
        line: lineOf(sourceFile, entry.value.getStart()),
        text: entry.value.text,
        category: "OBJECT_PROPERTY",
        classification: isConsistentMap ? "SPECIAL_HANDLING" : "MANUAL_REVIEW",
        reason: isConsistentMap
          ? "display value in an enum-code → label config map"
          : "value in an object literal with mixed/ambiguous key shapes; possible display-label map",
        context: entry.keyIsEnumCode ? "display-map value" : undefined,
      });
    }
  }

  /**
   * Detects string-literal return statements from plain (non-component) TS
   * helper functions, e.g. `nextReceiptAction()` returning `"Print receipt"`.
   * Conservatively classified as SPECIAL_HANDLING for now (never SAFE_AUTO)
   * since threading TFunction through helpers is a later-phase decision.
   * Technical-looking returns (CSS classes, enum codes, routes, etc.) are
   * excluded via the same structural checks used elsewhere.
   */
  function visitReturnStatement(node: ts.ReturnStatement) {
    const expr = node.expression;
    if (!expr || !ts.isStringLiteral(expr)) return;
    if (handledStringLiterals.has(expr)) return;

    const fn = getEnclosingFunctionLike(node);
    if (!fn || functionLooksLikeComponent(fn)) return; // leave JSX-producing components alone

    const text = expr.text;
    const shapeExclusion = checkValueShapeExclusion(text);
    if (shapeExclusion.excluded) {
      addExcluded(expr, text, shapeExclusion.reason ?? "structural exclusion");
      handledStringLiterals.add(expr);
      return;
    }
    if (!looksHumanReadable(text)) return;

    handledStringLiterals.add(expr);
    findings.push({
      filePath,
      line: lineOf(sourceFile, expr.getStart()),
      text,
      category: "FUNCTION_RETURN_STRING",
      classification: "SPECIAL_HANDLING",
      reason: "string literal returned from a plain helper function; candidate for TFunction threading",
    });
  }

  /**
   * Detects string/template arguments passed to known UI-message setter
   * calls (e.g. `setSuccessMessage("Tenant updated.")`), per the narrow,
   * repository-derived UI_MESSAGE_SETTER_NAME_PATTERN naming convention.
   */
  function visitCallExpression(node: ts.CallExpression) {
    const callee = node.expression;
    if (!ts.isIdentifier(callee) || !UI_MESSAGE_SETTER_NAME_PATTERN.test(callee.text)) return;

    const arg = node.arguments[0];
    if (!arg) return;

    if (ts.isStringLiteral(arg)) {
      if (handledStringLiterals.has(arg)) return;
      const shapeExclusion = checkValueShapeExclusion(arg.text);
      if (shapeExclusion.excluded) {
        addExcluded(arg, arg.text, shapeExclusion.reason ?? "structural exclusion");
        handledStringLiterals.add(arg);
        return;
      }
      if (!looksHumanReadable(arg.text)) return;
      handledStringLiterals.add(arg);
      findings.push({
        filePath,
        line: lineOf(sourceFile, arg.getStart()),
        text: arg.text,
        category: "MESSAGE_SETTER_ARGUMENT",
        classification: "SPECIAL_HANDLING",
        reason: `static user-facing message passed to "${callee.text}"`,
        context: callee.text,
      });
      return;
    }

    if (ts.isTemplateExpression(arg)) {
      if (!templateLooksUserFacing(arg)) return;
      findings.push({
        filePath,
        line: lineOf(sourceFile, arg.getStart()),
        text: arg.getText(),
        category: "MESSAGE_SETTER_ARGUMENT",
        classification: "SPECIAL_HANDLING",
        reason: `interpolated user-facing message passed to "${callee.text}"`,
        context: callee.text,
      });
      // Suppress the generic template-literal visitor from double-reporting this node.
      handledTemplateExpressions.add(arg);
    }
  }

  function visitBareStringLiteral(node: ts.StringLiteral) {
    if (handledStringLiterals.has(node) || handledDisplayMapValues.has(node)) return;
    const parent = node.parent;
    if (ts.isJsxAttribute(parent) || (ts.isPropertyAssignment(parent) && parent.initializer === node)) {
      return;
    }

    const text = node.text;

    if (isModuleSpecifier(node)) {
      addExcluded(node, text, "import/export module specifier");
      return;
    }
    if (isLiteralTypeMember(node)) {
      addExcluded(node, text, "TypeScript literal union member");
      return;
    }
    if (isComparisonOperand(node)) {
      addExcluded(node, text, "enum/status comparison operand");
      return;
    }
    if (isCaseClauseExpression(node)) {
      addExcluded(node, text, "switch/case discriminant");
      return;
    }
    if (isIntlConstructorArgument(node)) {
      addExcluded(node, text, "Intl constructor locale/options argument");
      return;
    }

    const shapeExclusion = checkValueShapeExclusion(text);
    if (shapeExclusion.excluded) {
      addExcluded(node, text, shapeExclusion.reason ?? "structural exclusion");
    }
  }

  visit(sourceFile);

  return { findings, excluded };
}
