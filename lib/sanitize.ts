import sanitizeHtml from "sanitize-html";

/**
 * Allowlist for lodge-authored rich text (about section, custom pages,
 * event descriptions). Scripts, styles, event handlers, iframes and
 * javascript: URLs are all stripped.
 */
const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "em", "b", "i", "u", "s",
    "h2", "h3", "h4",
    "ul", "ol", "li",
    "blockquote", "hr",
    "a", "img",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "title", "rel"],
    img: ["src", "alt"],
    td: ["colspan"],
    th: ["colspan"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: "noopener noreferrer nofollow" },
    }),
  },
};

export function sanitizeRichText(input: string | null | undefined): string {
  if (!input) return "";
  return sanitizeHtml(input, RICH_TEXT_OPTIONS).trim();
}

/**
 * Normalize a plain-text field: strip tags, control characters and excess
 * whitespace, then clamp to `max` characters.
 */
export function cleanText(input: string | null | undefined, max = 500): string {
  if (!input) return "";
  const noTags = sanitizeHtml(String(input), { allowedTags: [], allowedAttributes: {} });
  // eslint-disable-next-line no-control-regex
  const noControl = noTags.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  return noControl.replace(/\s+/g, " ").trim().slice(0, max);
}

/** Multi-line plain text (keeps newlines). */
export function cleanMultiline(input: string | null | undefined, max = 4000): string {
  if (!input) return "";
  const noTags = sanitizeHtml(String(input), { allowedTags: [], allowedAttributes: {} });
  // eslint-disable-next-line no-control-regex
  const noControl = noTags.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  return noControl.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim().slice(0, max);
}

export function slugify(input: string, max = 60): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}
