import { describe, expect, it } from "vitest";
import { parseTheme, THEME_COOKIE, THEME_INIT_SCRIPT } from "@/lib/theme";

describe("parseTheme", () => {
  it("accepts only the two known values", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
  });

  it("treats anything else as no preference, so the OS decides", () => {
    for (const v of ["", "DARK", "system", "auto", "dark; evil", undefined, null]) {
      expect(parseTheme(v)).toBeNull();
    }
  });
});

describe("THEME_INIT_SCRIPT", () => {
  /**
   * The script runs before paint to cover "no cookie, OS prefers dark". It must
   * not fire when a choice is already stored, or the server-rendered theme and
   * the painted one would disagree.
   */
  function run(cookie: string): boolean {
    let added = false;
    const sandbox = {
      document: { cookie, documentElement: { classList: { add: () => { added = true; } } } },
      window: { matchMedia: () => ({ matches: true }) },
    };
    new Function("document", "window", THEME_INIT_SCRIPT)(sandbox.document, sandbox.window);
    return added;
  }

  it("applies the OS preference when no choice is stored", () => {
    expect(run("")).toBe(true);
    expect(run("other=1")).toBe(true);
    // A different cookie that merely ends in the same name must not count.
    expect(run("not_tyled_theme=dark")).toBe(true);
  });

  it("defers to a stored choice", () => {
    expect(run(`${THEME_COOKIE}=dark`)).toBe(false);
    expect(run(`${THEME_COOKIE}=light`)).toBe(false);
    expect(run(`other=1; ${THEME_COOKIE}=light`)).toBe(false);
  });
});
