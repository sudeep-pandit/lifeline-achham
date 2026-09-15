// Wraps a dedicated BS/AD conversion library rather than approximating
// dates by hand (Section 36 explicitly requires this). Add "bikram-sambat-js"
// (or an equivalent maintained package) to apps/api/package.json dependencies
// before running - kept as a single call site so the library can be swapped
// without touching callers.
import BikramSambat from "bikram-sambat-js";

export function adToBs(date: Date): string {
  // The library's published type declarations say toBS() returns a plain
  // string (already formatted), but this hasn't been verified against a
  // live run (no network access was available while building this) - so
  // this handles either a string or a {year,month,day} object defensively
  // rather than assuming one and breaking on the other.
  const bs: unknown = new BikramSambat(date, "AD").toBS();
  if (typeof bs === "string") return bs;
  const parts = bs as { year: number; month: number; day: number };
  return `${parts.year}/${String(parts.month).padStart(2, "0")}/${String(parts.day).padStart(2, "0")}`;
}

export function dayOfWeek(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

export function formatAd(date: Date): string {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
