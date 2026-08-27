/**
 * Allowlist sanitizer for `richtext` field values.
 *
 * Threat model: rich text is authored inside a generated app, stored in Bench,
 * and rendered back into a sandboxed iframe. The sandbox already contains the
 * blast radius of any script that got through, and Bench's own UI renders these
 * values as escaped text, never as HTML. This is defence in depth rather than
 * the only thing standing between a payload and an origin — but stored content
 * that is served back to other people is exactly the thing worth being strict
 * about, so the rule is allowlist-only: anything not named here is removed.
 */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "h3",
  "h4",
  "blockquote",
  "code",
  "pre",
  "a",
]);

/** Only `a` carries an attribute, and only href. */
const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(["href"]),
};

const SAFE_URL = /^(https?:\/\/|mailto:|\/)/i;

export const MAX_RICHTEXT_LENGTH = 50_000;

/** Elements whose *contents* must go too, not just their tags. */
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|template|noscript)\b[\s\S]*?<\/\1\s*>/gi;

export function sanitizeHtml(input: string): string {
  let html = input.slice(0, MAX_RICHTEXT_LENGTH);

  // Unclosed <script> would otherwise survive the tag pass as a bare tag with
  // its body treated as text, so strip these wholesale first.
  html = html.replace(DROP_WITH_CONTENT, "");
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  html = html.replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (
    match,
    rawName: string,
    rawAttributes: string,
  ) => {
    const name = rawName.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return "";
    if (match.startsWith("</")) return `</${name}>`;

    const allowed = ALLOWED_ATTRIBUTES[name];
    if (!allowed) return `<${name}>`;

    const kept: string[] = [];
    const attributePattern = /([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let attribute: RegExpExecArray | null;

    while ((attribute = attributePattern.exec(rawAttributes)) !== null) {
      const key = attribute[1].toLowerCase();
      const value = attribute[3] ?? attribute[4] ?? "";
      if (!allowed.has(key)) continue;
      if (key === "href" && !SAFE_URL.test(value.trim())) continue;
      kept.push(`${key}="${escapeAttribute(value)}"`);
    }

    // Links leave the sandbox, so they must not be able to reach back into it.
    if (name === "a" && kept.length > 0) {
      kept.push('target="_blank"', 'rel="noopener noreferrer"');
    }

    return kept.length > 0 ? `<${name} ${kept.join(" ")}>` : `<${name}>`;
  });

  // Any angle bracket that was not part of an allowed tag is literal text.
  html = html.replace(/<(?![/a-zA-Z])/g, "&lt;");

  return html.trim();
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Plain-text preview of rich text, for tables and truncated cells. */
export function richTextToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|li|h3|h4|blockquote)>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
