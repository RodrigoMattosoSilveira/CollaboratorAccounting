export function TernaryStringsFixture({ isSaving, isActive }: { isSaving: boolean; isActive: boolean }) {
  return (
    <div>
      <button>{isSaving ? "Saving..." : "Save Tenant"}</button>
      <button>{isActive ? "Deactivate Tenant" : "Activate Tenant"}</button>
    </div>
  );
}
