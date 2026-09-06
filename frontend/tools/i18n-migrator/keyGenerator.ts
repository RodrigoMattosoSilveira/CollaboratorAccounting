/**
 * Deterministic semantic key generation for Phase 2A transformation planning.
 *
 * Rules (per Phase 2A spec):
 *   - deterministic: same (english text, category, context) always yields the
 *     same key before collision resolution
 *   - semantic camelCase, not the raw English text
 *   - no random suffixes
 *   - reuse an existing key if the exact English value already exists in the
 *     namespace (handled by the translation store, not here)
 *   - collision detection: two different English values that would generate
 *     the same base key get a deterministic, context-derived disambiguator
 *     rather than a numeric/random suffix; if that is still ambiguous, the
 *     caller should downgrade the finding instead of guessing
 */

const STOP_WORDS = new Set([
  "a", "an", "the", "of", "to", "for", "and", "or", "is", "are", "this", "that", "in", "on", "at", "by", "with",
]);

/** A small set of category-implied semantic key hints, matched by JSX tag context.
 *  Limited to the single well-established repo convention (page/section <h1> title)
 *  since blindly mapping prop names like "placeholder" to the literal key
 *  "placeholder" would not be semantic (the placeholder's own text should
 *  drive its key, e.g. "Enter gold price" -> "enterGoldPrice").
 */
const CONTEXT_KEY_HINTS: Readonly<Record<string, string>> = {
  h1: "title",
};

function toWords(text: string): string[] {
  return text
    .replace(/[’']/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function toCamelCase(words: string[]): string {
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

/**
 * Reduce a full English sentence/phrase to a short semantic camelCase key.
 * Uses simple heuristics (ellipsis => "loading"/"…ing" verb forms, leading
 * "No X found" => "noResults", short phrases used verbatim) — deliberately
 * conservative, not an NLP model, per "do not guess aggressively".
 */
export function generateKeyCandidate(text: string, context?: { tagName?: string; propName?: string }): string {
  const trimmed = text.trim();

  // Ellipsis-style progress text, e.g. "Recording...", "Loading gold prices..." -> "loading"/"recording" style.
  if (/\.\.\.$|…$/.test(trimmed)) {
    const words = toWords(trimmed.replace(/\.\.\.$|…$/, ""));
    if (words.length > 0 && /^(loading|saving|recording|creating|assigning|preparing|updating|deleting)$/i.test(words[0]!)) {
      return words[0]!.toLowerCase();
    }
  }

  // "No X found." / "No X yet" -> noResults.
  if (/^no\s+.+\b(found|yet)\b\.?$/i.test(trimmed)) {
    return "noResults";
  }

  // Short (<=3 word) phrases: use the words directly as the camelCase key.
  const words = toWords(trimmed).filter((w) => !STOP_WORDS.has(w.toLowerCase()));
  if (words.length > 0 && words.length <= 3 && trimmed.length <= 30) {
    return toCamelCase(words);
  }

  // Context-implied hint (tag/prop name) for longer sentences without an obvious short form.
  if (context?.propName && CONTEXT_KEY_HINTS[context.propName]) {
    return CONTEXT_KEY_HINTS[context.propName]!;
  }
  if (context?.tagName && CONTEXT_KEY_HINTS[context.tagName]) {
    return CONTEXT_KEY_HINTS[context.tagName]!;
  }

  // Fall back to the first few significant words of a longer sentence.
  const firstWords = words.slice(0, 4);
  if (firstWords.length > 0) {
    return toCamelCase(firstWords);
  }

  return "text";
}

/** Deterministically disambiguate a key when it collides with a DIFFERENT English value. */
export function disambiguateKey(baseKey: string, context: { tagName?: string; propName?: string; index: number }): string {
  const suffix = context.propName ?? context.tagName;
  if (suffix) {
    return `${baseKey}${suffix.charAt(0).toUpperCase()}${suffix.slice(1)}`;
  }
  // No usable context-derived suffix: this is genuinely ambiguous; caller should
  // downgrade to MANUAL_REVIEW rather than accept a numeric-suffix guess.
  return `${baseKey}${context.index}`;
}
