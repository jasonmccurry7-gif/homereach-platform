import { describe, expect, it } from "vitest";
import { cleanEmailSubjectPart } from "../email";

describe("email subject cleaning", () => {
  it("removes control characters and collapses whitespace", () => {
    expect(cleanEmailSubjectPart("Acme\r\nBcc: attacker@example.com\tShop")).toBe(
      "Acme Bcc: attacker@example.com Shop",
    );
  });

  it("uses a bounded fallback for blank values", () => {
    expect(cleanEmailSubjectPart("", "Fallback Name")).toBe("Fallback Name");
  });
});
