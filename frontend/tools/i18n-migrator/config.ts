/**
 * Minimal configuration for Phase 1 of the i18n migrator.
 *
 * Intentionally does NOT include namespace mapping, key generation, or a
 * suppression framework — those belong to later phases.
 */

/** JSX tag names whose direct static text children are SAFE_AUTO candidates. */
export const SAFE_TEXT_TAGS: ReadonlySet<string> = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "button",
  "a",
  "Link",
  "p",
  "span",
  "label",
  "th",
  "td",
  "option",
  "dt",
  "dd",
  "legend",
  "summary",
]);

/**
 * Native semantic HTML *container* tags. Unlike SAFE_TEXT_TAGS, these
 * typically wrap larger regions of markup, so they are only SAFE_AUTO when
 * they contain a single, complete, non-fragmented text node (see
 * visitJsxChildren) — otherwise the existing fragmented-JSX handling applies.
 */
export const SAFE_TEXT_CONTAINER_TAGS: ReadonlySet<string> = new Set([
  "main",
  "section",
  "article",
  "aside",
  "header",
  "footer",
]);

/**
 * Native tags whose text content is technical/code display by convention
 * (monospace identifiers, path fragments, etc.), not prose. Whole-string
 * static text here stays MANUAL_REVIEW rather than SAFE_AUTO/EXCLUDED,
 * since occasionally genuine explanatory prose appears inside a <code>
 * block and a human should judge it.
 */
export const TECHNICAL_DISPLAY_TAGS: ReadonlySet<string> = new Set(["code", "pre", "kbd", "samp"]);

/** JSX props that are considered user-facing text when their tag is not obviously technical. */
export const ALLOWED_TEXT_PROPS: ReadonlySet<string> = new Set([
  "label",
  "placeholder",
  "title",
  "helperText",
  "aria-label",
]);

/**
 * Known-vetted custom component/prop pairs that are safe display text in the
 * current frontend codebase. Unknown custom-component text props remain manual.
 *
 * Config-driven so vetting new custom components/props does not require
 * touching classifier logic (see `customComponentDisplayProps` below for the
 * grouped-by-component form; this flattened set is derived from it).
 */
export const CUSTOM_COMPONENT_DISPLAY_PROPS: Readonly<Record<string, readonly string[]>> = {
  PriceListItemForm: ["title", "description", "submitLabel", "pendingLabel"],
  SummaryCard: ["label"],
  Item: ["label"],
  Signature: ["label"],
};

export const KNOWN_CUSTOM_SAFE_TEXT_PROPS: ReadonlySet<string> = new Set(
  Object.entries(CUSTOM_COMPONENT_DISPLAY_PROPS).flatMap(([component, props]) =>
    props.map((prop) => `${component}.${prop}`),
  ),
);

/** JSX/attribute names whose string values are always structural/technical, never UI text. */
export const DENIED_TECHNICAL_PROPS: ReadonlySet<string> = new Set([
  "className",
  "to",
  "href",
  "data-testid",
  "id",
  "name",
  "type",
  "key",
  "role",
  "value",
  "htmlFor",
  "rel",
  "target",
  "method",
  "action",
  "layout",
  "aria-describedby",
  "aria-controls",
  "aria-labelledby",
  "aria-owns",
  "aria-details",
  "aria-errormessage",
  "aria-activedescendant",
  "aria-flowto",
]);

/**
 * Props that are HTML/input *configuration* (not user-facing text) when used
 * on a native (lowercase) JSX element such as <input>/<textarea>/<form>.
 *
 * These are intentionally NOT included in the global DENIED_TECHNICAL_PROPS
 * set because a custom component could plausibly use a same-named prop
 * (e.g. a design-system component's own `pattern` or `accept` prop) for a
 * different, potentially user-facing, purpose. Restricting the exclusion to
 * native elements keeps it conservative.
 */
export const NATIVE_ELEMENT_TECHNICAL_PROPS: ReadonlySet<string> = new Set([
  "inputMode",
  "min",
  "max",
  "step",
  "pattern",
  "autoComplete",
  "autoFocus",
  "checked",
  "defaultChecked",
  "defaultValue",
  "rows",
  "cols",
  "maxLength",
  "minLength",
  "accept",
]);

/**
 * Function-name pattern for known UI-message setter calls in this repository
 * (React `useState` setters such as `setSuccessMessage`, `setMessage`,
 * `setRefinementMessage`). A string literal/template passed as the sole or
 * first argument to a matching call is a candidate user-facing message.
 *
 * Intentionally a narrow, repository-derived naming convention rather than
 * "any function call with a string argument" — that would be far too broad.
 */
export const UI_MESSAGE_SETTER_NAME_PATTERN = /^set[A-Za-z0-9]*Message$/;

/** Directory name fragments to skip entirely while walking the file tree. */
export const IGNORED_DIR_PATTERNS: ReadonlyArray<string> = [
  "node_modules",
  "dist",
  "build",
  ".git",
  "coverage",
  "playwright-report",
  "test-results",
  "locales",
  "__tests__",
];

/**
 * File name patterns to skip during *application* audit source discovery.
 * The migrator's own tests under tools/i18n-migrator/tests/ are run
 * directly (not via this discovery path) and are unaffected.
 */
export const IGNORED_FILE_PATTERNS: ReadonlyArray<RegExp> = [
  /\.d\.ts$/,
  /\.test\.tsx?$/,
  /\.spec\.tsx?$/,
];
