import { afterEach, describe, expect, it } from "vitest";
import { getInternalAppBaseUrl, getPublicAppBaseUrl } from "../app-url";

const KEYS = [
  "NEXTAUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_BASE_URL",
  "VERCEL_BRANCH_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL",
] as const;

const originalEnv = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("app url helpers", () => {
  it("prefers NEXTAUTH_URL for internal server calls", () => {
    process.env.NEXTAUTH_URL = "https://auth.example.com/";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";

    expect(getInternalAppBaseUrl()).toBe("https://auth.example.com");
  });

  it("falls back to the public app URL before localhost for internal calls", () => {
    delete process.env.NEXTAUTH_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com/";

    expect(getInternalAppBaseUrl()).toBe("https://app.example.com");
  });

  it("uses public URL aliases in canonical order", () => {
    delete process.env.NEXTAUTH_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://site.example.com/";
    process.env.NEXT_PUBLIC_BASE_URL = "https://base.example.com/";

    expect(getPublicAppBaseUrl()).toBe("https://site.example.com");
  });

  it("uses Vercel deployment URLs when canonical app aliases are missing", () => {
    delete process.env.NEXTAUTH_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_BASE_URL;
    process.env.VERCEL_BRANCH_URL = "branch-preview.vercel.app/";
    process.env.VERCEL_URL = "unique-preview.vercel.app";

    expect(getPublicAppBaseUrl()).toBe("https://branch-preview.vercel.app");
  });

  it("uses Vercel URLs before localhost for internal deployed calls", () => {
    delete process.env.NEXTAUTH_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_BASE_URL;
    delete process.env.VERCEL_BRANCH_URL;
    process.env.VERCEL_URL = "unique-preview.vercel.app";

    expect(getInternalAppBaseUrl()).toBe("https://unique-preview.vercel.app");
  });
});
