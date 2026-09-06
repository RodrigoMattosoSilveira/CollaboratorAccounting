/**
 * Conservative structural exclusion helpers.
 *
 * These use AST context (parent node kind, containing property/attribute
 * name, call target) rather than "contains English letters" style regexes,
 * per the Phase 1 design goal of minimizing false positives.
 */
import ts from "typescript";
import { DENIED_TECHNICAL_PROPS } from "./config";

const LOCALE_LIKE = /^[a-z]{2}(-[A-Z]{2})?$/;
const ENUM_CODE_LIKE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;
const PATH_OR_URL_LIKE = /^\//.source + "|" + /:\/\//.source;
const PATH_OR_URL_RE = new RegExp(PATH_OR_URL_LIKE);

export interface ExclusionCheck {
  excluded: boolean;
  reason?: string;
}

/** Structural value-shape checks that apply regardless of AST context. */
export function checkValueShapeExclusion(text: string): ExclusionCheck {
  if (PATH_OR_URL_RE.test(text)) {
    return { excluded: true, reason: "looks like a route/API path or URL" };
  }
  if (LOCALE_LIKE.test(text)) {
    return { excluded: true, reason: "looks like an Intl/BCP-47 locale identifier" };
  }
  if (ENUM_CODE_LIKE.test(text) && text.length > 1) {
    return { excluded: true, reason: "looks like an enum/status code (SCREAMING_SNAKE_CASE)" };
  }
  return { excluded: false };
}

/** Is this JSX/object-literal property name structurally technical? */
export function isDeniedTechnicalPropName(name: string): boolean {
  return DENIED_TECHNICAL_PROPS.has(name);
}

/** Is a string literal node an import/export module specifier? */
export function isModuleSpecifier(node: ts.StringLiteral): boolean {
  const parent = node.parent;
  return (
    (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) &&
    parent.moduleSpecifier === node
  );
}

/** Is a string literal node a TypeScript literal-type union member (type position)? */
export function isLiteralTypeMember(node: ts.StringLiteral): boolean {
  return ts.isLiteralTypeNode(node.parent);
}

/** Is a string literal node compared with === / !== (an enum/status comparison)? */
export function isComparisonOperand(node: ts.StringLiteral): boolean {
  const parent = node.parent;
  return (
    ts.isBinaryExpression(parent) &&
    (parent.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      parent.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken ||
      parent.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
      parent.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken)
  );
}

/** Is a string literal node the discriminant of a switch/case clause? */
export function isCaseClauseExpression(node: ts.StringLiteral): boolean {
  return ts.isCaseClause(node.parent) && node.parent.expression === node;
}

/** Is this call/new expression targeting the global `Intl` namespace (e.g. Intl.NumberFormat)? */
export function isIntlConstructorArgument(node: ts.StringLiteral): boolean {
  const parent = node.parent;
  if (!ts.isCallExpression(parent) && !ts.isNewExpression(parent)) return false;
  if (parent.arguments?.[0] !== node) return false;

  const callee = parent.expression;
  if (!ts.isPropertyAccessExpression(callee)) return false;
  return ts.isIdentifier(callee.expression) && callee.expression.text === "Intl";
}
