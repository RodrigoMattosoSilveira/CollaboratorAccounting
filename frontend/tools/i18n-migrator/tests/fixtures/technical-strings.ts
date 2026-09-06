export const STATUS_ROUTE = "/admin/reference-data";
export const DEFAULT_LOCALE = "en-US";

export function isPendingIssue(status: string) {
  return status === "PENDING_ISSUE";
}
