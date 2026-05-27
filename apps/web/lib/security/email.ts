export function cleanEmailSubjectPart(value: unknown, fallback = "Unknown"): string {
  const text = value == null ? "" : String(value);
  const cleaned = text
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (cleaned || fallback).slice(0, 160);
}
