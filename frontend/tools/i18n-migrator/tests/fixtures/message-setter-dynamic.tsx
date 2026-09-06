import { useState } from "react";

interface Tenant {
  name: string;
}

export function TenantEditForm({ tenant }: { tenant: Tenant }) {
  const [, setSuccessMessage] = useState("");
  const save = () => {
    setSuccessMessage(`${tenant.name} updated.`);
  };
  return save;
}
