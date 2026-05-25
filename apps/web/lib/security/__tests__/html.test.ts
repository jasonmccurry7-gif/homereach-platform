import { describe, expect, it } from "vitest";
import { escapeHtml, escapeHtmlOr } from "../html";

describe("html escaping", () => {
  it("escapes characters that can change HTML structure", () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')" /> & copy`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot; /&gt; &amp; copy",
    );
  });

  it("uses escaped fallbacks for blank optional values", () => {
    expect(escapeHtmlOr("   ", "<missing>")).toBe("&lt;missing&gt;");
  });
});
