// Plain TS helper function returning user-facing strings conditionally.
export function nextAction(step: number): string {
  if (step >= 3) {
    return "Print receipt";
  }
  return "No action allowed";
}
