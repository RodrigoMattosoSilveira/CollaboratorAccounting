export function TechnicalTemplatesFixture({ tenantId }: { tenantId: string }) {
  return (
    <div>
      <a href={`/admin/tenants/${tenantId}`}>Tenant</a>
      <div className={`rounded-xl px-4 py-2 text-sm font-semibold ${tenantId ? "bg-gray-950 text-white" : "bg-white text-gray-900"}`}>ClassName</div>
    </div>
  );
}
