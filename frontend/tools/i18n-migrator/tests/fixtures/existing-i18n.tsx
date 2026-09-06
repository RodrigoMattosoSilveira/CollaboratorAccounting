import { useTranslation } from "react-i18next";

export function ExistingI18nFixture() {
  const { t } = useTranslation();
  return <h1>{t("title")}</h1>;
}
