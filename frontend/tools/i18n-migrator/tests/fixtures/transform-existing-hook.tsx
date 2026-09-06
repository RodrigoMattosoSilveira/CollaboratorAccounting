import { useTranslation } from "react-i18next";

export function TransformExistingHookFixture() {
  const { t } = useTranslation("goldPrices");
  return (
    <div>
      <h1>Gold Prices</h1>
      <p>{t("existing")}</p>
    </div>
  );
}
