#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const frontendRoot = path.resolve(scriptDir, "..");
  const localesRoot = path.join(frontendRoot, "src", "locales");
  const i18nFile = path.join(frontendRoot, "src", "app", "i18n.ts");

  const namespaces = await readNamespaces(path.join(localesRoot, "en"));
  if (namespaces.length === 0) {
    fail("No namespace files found in src/locales/en.");
  }

  const localeCodes = await readLocaleCodes(localesRoot, namespaces);
  const localeCodesWithEn = ["en", ...localeCodes.filter((code) => code !== "en")];

  const nextContent = buildI18nFile({ namespaces, localeCodes: localeCodesWithEn });

  if (args.dryRun) {
    const current = await fs.readFile(i18nFile, "utf8");
    if (current === nextContent) {
      console.log("[dry-run] i18n.ts is already up to date");
    } else {
      console.log("[dry-run] i18n.ts would be updated");
    }
    return;
  }

  await fs.writeFile(i18nFile, nextContent, "utf8");
  console.log(
    `[write] updated src/app/i18n.ts with locales=${localeCodesWithEn.join(",")}; namespaces=${namespaces.join(",")}`,
  );
}

function parseArgs(argv) {
  const args = { dryRun: false };

  for (const token of argv) {
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (token === "-h" || token === "--help") {
      printUsage();
      process.exit(0);
    }
    fail(`Unknown argument: ${token}`);
  }

  return args;
}

async function readNamespaces(enLocaleDir) {
  const entries = await fs.readdir(enLocaleDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name.replace(/\.json$/u, ""))
    .sort((a, b) => a.localeCompare(b));
}

async function readLocaleCodes(localesRoot, namespaces) {
  const entries = await fs.readdir(localesRoot, { withFileTypes: true });
  const allCodes = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  if (!allCodes.includes("en")) {
    fail("Missing required src/locales/en directory.");
  }

  const codes = [];
  for (const code of allCodes) {
    if (code === "en") {
      codes.push(code);
      continue;
    }

    const hasAllNamespaces = await localeHasAllNamespaces(
      path.join(localesRoot, code),
      namespaces,
    );
    if (hasAllNamespaces) {
      codes.push(code);
      continue;
    }

    console.warn(
      `i18n-sync-config: skipping locale ${code} because one or more namespace files are missing`,
    );
  }

  return codes;
}

async function localeHasAllNamespaces(localeDir, namespaces) {
  for (const namespace of namespaces) {
    const filePath = path.join(localeDir, `${namespace}.json`);
    try {
      await fs.access(filePath);
    } catch {
      return false;
    }
  }
  return true;
}

function buildI18nFile({ namespaces, localeCodes }) {
  const importLines = [];
  importLines.push('import i18n from "i18next";');
  importLines.push('import LanguageDetector from "i18next-browser-languagedetector";');
  importLines.push('import { initReactI18next } from "react-i18next";');

  for (const namespace of namespaces) {
    importLines.push(
      `import ${bindingName(namespace, "en")} from "../locales/en/${namespace}.json";`,
    );

    for (const locale of localeCodes) {
      if (locale === "en") continue;
      importLines.push(
        `import ${bindingName(namespace, locale)} from "../locales/${locale}/${namespace}.json";`,
      );
    }
  }

  const resourceLines = localeCodes.map((locale) => {
    const pairLines = namespaces.map(
      (namespace) => `${namespace}: ${bindingName(namespace, locale)}`,
    );

    const localeKey = locale === "en" ? "en" : `"${locale}"`;
    return `      ${localeKey}: { ${pairLines.join(", ")} },`;
  });

  const supportedLngs = localeCodes.map((locale) => `"${locale}"`).join(", ");
  const nsList = namespaces.map((namespace) => `"${namespace}"`).join(", ");

  return `${importLines.join("\n")}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
${resourceLines.join("\n")}
    },
    fallbackLng: "en",
    supportedLngs: [${supportedLngs}],
    defaultNS: "common",
    ns: [${nsList}],
    interpolation: { escapeValue: false },
    detection: {
      order: ["querystring", "localStorage", "navigator"],
      caches: ["localStorage"],
    },
    react: { useSuspense: false },
  });

export default i18n;
`;
}

function bindingName(namespace, locale) {
  const ns = toIdentifierPart(namespace);
  const lang = toIdentifierPart(locale);
  return `${ns}${capitalize(lang)}`;
}

function toIdentifierPart(value) {
  const alnum = value.replace(/[^a-zA-Z0-9]+/gu, " ").trim();
  if (!alnum) return "x";

  return alnum
    .split(/\s+/u)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index === 0) return lower;
      return capitalize(lower);
    })
    .join("");
}

function capitalize(value) {
  if (!value) return value;
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function printUsage() {
  console.log(`Usage:\n  npm run i18n:sync-config [-- --dry-run]\n\nOptions:\n  --dry-run    Check whether src/app/i18n.ts would change\n`);
}

function fail(message) {
  console.error(`i18n-sync-config: ${message}`);
  process.exit(1);
}

main().catch((error) => {
  fail(String(error));
});
