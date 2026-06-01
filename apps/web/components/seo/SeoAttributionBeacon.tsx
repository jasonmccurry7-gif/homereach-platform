"use client";

import { useEffect } from "react";

const SESSION_KEY = "homereach_seo_session_id";
const LANDING_KEY = "homereach_seo_landing_path";

export function SeoAttributionBeacon() {
  useEffect(() => {
    if (shouldSkipPath(window.location.pathname)) return;
    const sessionId = getOrCreateSessionId();
    const landingPath = getOrCreateLandingPath();
    const currentUrl = new URL(window.location.href);
    const payload = {
      eventName: "page_view",
      sessionId,
      landingPath,
      pagePath: currentUrl.pathname,
      referrer: document.referrer || null,
      source: currentUrl.searchParams.get("utm_source") ?? null,
      medium: currentUrl.searchParams.get("utm_medium") ?? null,
      campaign: currentUrl.searchParams.get("utm_campaign") ?? null,
      term: currentUrl.searchParams.get("utm_term") ?? null,
      content: currentUrl.searchParams.get("utm_content") ?? null,
      metadata: {
        src: currentUrl.searchParams.get("src") ?? null,
        title: document.title,
      },
    };

    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/seo-attribution/events", new Blob([body], { type: "application/json" }));
      return;
    }

    fetch("/api/seo-attribution/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  }, []);

  return null;
}

function shouldSkipPath(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/checkout")
  );
}

function getOrCreateSessionId() {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return `fallback-${Date.now()}`;
  }
}

function getOrCreateLandingPath() {
  try {
    const existing = window.sessionStorage.getItem(LANDING_KEY);
    if (existing) return existing;
    const value = window.location.pathname;
    window.sessionStorage.setItem(LANDING_KEY, value);
    return value;
  } catch {
    return "/";
  }
}
