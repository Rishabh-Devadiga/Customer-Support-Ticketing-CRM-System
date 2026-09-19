/** Shared date formatting for ticket timestamps (ISO-8601 UTC from the API). */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
