// Plain TS helper function returning purely technical values (CSS classes,
// enum-style codes). Must never be classified SAFE_AUTO from this change.
export function toneClass(status: string): string {
  switch (status) {
    case "PENDING_ISSUE":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function statusCode(): string {
  return "PENDING_ISSUE";
}
