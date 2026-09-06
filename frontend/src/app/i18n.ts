import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import collaboratorsEn from "../locales/en/collaborators.json";
import collaboratorsPtBr from "../locales/pt-BR/collaborators.json";
import commonEn from "../locales/en/common.json";
import commonPtBr from "../locales/pt-BR/common.json";
import currentaccountsEn from "../locales/en/currentAccounts.json";
import currentaccountsPtBr from "../locales/pt-BR/currentAccounts.json";
import expensesEn from "../locales/en/expenses.json";
import expensesPtBr from "../locales/pt-BR/expenses.json";
import goldPricesEn from "../locales/en/goldPrices.json";
import goldPricesPtBr from "../locales/pt-BR/goldPrices.json";
import peopleEn from "../locales/en/people.json";
import peoplePtBr from "../locales/pt-BR/people.json";
import planningEn from "../locales/en/planning.json";
import planningPtBr from "../locales/pt-BR/planning.json";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { collaborators: collaboratorsEn, common: commonEn, currentAccounts: currentaccountsEn, expenses: expensesEn, goldPrices: goldPricesEn, people: peopleEn, planning: planningEn },
      "pt-BR": { collaborators: collaboratorsPtBr, common: commonPtBr, currentAccounts: currentaccountsPtBr, expenses: expensesPtBr, goldPrices: goldPricesPtBr, people: peoplePtBr, planning: planningPtBr },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "pt-BR"],
    defaultNS: "common",
    ns: ["collaborators", "common", "currentAccounts", "expenses", "goldPrices", "people", "planning"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["querystring", "localStorage", "navigator"],
      caches: ["localStorage"],
    },
    react: { useSuspense: false },
  });

export default i18n;
