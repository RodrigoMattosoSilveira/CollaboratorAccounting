import { useState } from "react";

interface Created {
  priceDate: string;
}

export function TransformInterpolationFixture({ created }: { created: Created }) {
  const [, setSuccessMessage] = useState("");
  const handleSuccess = () => {
    setSuccessMessage(`Gold price for ${created.priceDate} recorded.`);
  };
  return handleSuccess;
}
