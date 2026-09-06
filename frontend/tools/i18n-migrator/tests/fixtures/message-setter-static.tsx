import { useState } from "react";

export function TenantEditForm() {
  const [, setSuccessMessage] = useState("");
  const save = () => {
    setSuccessMessage("Tenant updated.");
  };
  return save;
}
