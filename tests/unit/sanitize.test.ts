import { describe, expect, it } from "vitest";
import { cleanMultiline, cleanText, sanitizeRichText, slugify } from "@/lib/sanitize";

describe("sanitizeRichText", () => {
  it("strips scripts, event handlers and javascript: URLs", () => {
    const dirty =
      '<p onclick="x()">Hello <script>alert(1)</script><a href="javascript:alert(1)">bad</a> <a href="https://ok.org">ok</a></p><iframe src="https://evil"></iframe><img src="x" onerror="alert(1)">';
    const clean = sanitizeRichText(dirty);
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("onerror");
    expect(clean).not.toContain("javascript:");
    expect(clean).not.toContain("<iframe");
    expect(clean).toContain('<a href="https://ok.org" rel="noopener noreferrer nofollow">ok</a>');
  });

  it("keeps allowed formatting", () => {
    const clean = sanitizeRichText("<h2>Title</h2><ul><li><strong>bold</strong></li></ul><p>text</p>");
    expect(clean).toBe("<h2>Title</h2><ul><li><strong>bold</strong></li></ul><p>text</p>");
  });

  it("drops style and unknown tags but keeps text", () => {
    expect(sanitizeRichText('<div style="color:red"><span>hi</span></div>')).toBe("hi");
  });
});

describe("cleanText", () => {
  it("removes tags, control chars and collapses whitespace", () => {
    expect(cleanText("  <b>Lodge</b>\u0000 No.\n\n 1  ")).toBe("Lodge No. 1");
  });
  it("clamps length", () => {
    expect(cleanText("a".repeat(600), 10)).toHaveLength(10);
  });
  it("keeps newlines in multiline text", () => {
    expect(cleanMultiline("line one \r\nline <i>two</i>")).toBe("line one\nline two");
  });
});

describe("slugify", () => {
  it("makes url-safe slugs", () => {
    expect(slugify("St. John's Lodge No. 12!")).toBe("st-john-s-lodge-no-12");
    expect(slugify("Ünïcode Lödge")).toBe("unicode-lodge");
  });
});
