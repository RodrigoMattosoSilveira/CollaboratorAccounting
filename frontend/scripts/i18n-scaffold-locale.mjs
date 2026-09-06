#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const VALID_STUB_MODES = new Set(["copy", "todo", "empty"]);

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.lang) {
    printUsage();
    process.exit(args.help ? 0 : 1);
  }

  if (!VALID_STUB_MODES.has(args.stub)) {
    fail(`Unsupported --stub value: ${args.stub}`);
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const frontendRoot = path.resolve(scriptDir, "..");
  const sourceDir = path.join(frontendRoot, "src", "locales", args.source);
  const targetDir = path.join(frontendRoot, "src", "locales", args.lang);

  const sourceFiles = await localeJsonFiles(sourceDir);
  if (sourceFiles.length === 0) {
    fail(`No JSON locale files found in ${sourceDir}`);
  }

  await fs.mkdir(targetDir, { recursive: true });

  const summary = { created: 0, updated: 0, unchanged: 0 };

  for (const fileName of sourceFiles) {
    const sourcePath = path.join(sourceDir, fileName);
    const targetPath = path.join(targetDir, fileName);

    const sourceJson = await readJson(sourcePath);
    const targetJson = await readJsonIfExists(targetPath);

    const merged = mergeLocaleTree(sourceJson, targetJson, args);
    const nextText = stableJsonText(merged);
    const prevText = targetJson === null ? null : stableJsonText(targetJson);

    if (prevText === null) {
      summary.created += 1;
      if (!args.dryRun) {
        await fs.writeFile(targetPath, nextText, "utf8");
      }
      continue;
    }

    if (prevText !== nextText) {
      summary.updated += 1;
      if (!args.dryRun) {
        await fs.writeFile(targetPath, nextText, "utf8");
      }
      continue;
    }

    summary.unchanged += 1;
  }

  const mode = args.dryRun ? "[dry-run]" : "[write]";
  console.log(
    `${mode} locale ${args.lang}: created=${summary.created} updated=${summary.updated} unchanged=${summary.unchanged}`,
  );
}

function parseArgs(argv) {
  const args = {
    lang: "",
    source: "en",
    stub: "todo",
    overwriteExisting: false,
    prune: false,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--lang") {
      args.lang = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }
    if (token === "--source") {
      args.source = String(argv[i + 1] || "").trim() || "en";
      i += 1;
      continue;
    }
    if (token === "--stub") {
      args.stub = String(argv[i + 1] || "").trim() || "todo";
      i += 1;
      continue;
    }
    if (token === "--overwrite-existing") {
      args.overwriteExisting = true;
      continue;
    }
    if (token === "--prune") {
      args.prune = true;
      continue;
    }
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (token === "-h" || token === "--help") {
      args.help = true;
      continue;
    }

    fail(`Unknown argument: ${token}`);
  }

  return args;
}

async function localeJsonFiles(localeDir) {
  const entries = await fs.readdir(localeDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function readJson(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`Invalid JSON in ${filePath}: ${String(error)}`);
  }
}

async function readJsonIfExists(filePath) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function mergeLocaleTree(source, target, options) {
  if (!isPlainObject(source)) {
    fail("Source locale root must be a JSON object.");
  }

  const safeTarget = isPlainObject(target) ? target : {};
  return mergeNode(source, safeTarget, options, options.lang);
}

function mergeNode(sourceNode, targetNode, options, lang) {
  if (isPlainObject(sourceNode)) {
    const result = {};

    for (const key of Object.keys(sourceNode)) {
      const sourceValue = sourceNode[key];
      const hasTargetValue = isPlainObject(targetNode) && Object.prototype.hasOwnProperty.call(targetNode, key);
      const targetValue = hasTargetValue ? targetNode[key] : undefined;

      if (!hasTargetValue) {
        result[key] = makeStubValue(sourceValue, options.stub, lang);
        continue;
      }

      if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
        result[key] = mergeNode(sourceValue, targetValue, options, lang);
        continue;
      }

      if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
        result[key] = options.overwriteExisting
          ? makeStubValue(sourceValue, options.stub, lang)
          : targetValue;
        continue;
      }

      result[key] = options.overwriteExisting
        ? makeStubValue(sourceValue, options.stub, lang)
        : targetValue;
    }

    if (!options.prune && isPlainObject(targetNode)) {
      for (const key of Object.keys(targetNode)) {
        if (!Object.prototype.hasOwnProperty.call(result, key)) {
          result[key] = targetNode[key];
        }
      }
    }

    return result;
  }

  return options.overwriteExisting
    ? makeStubValue(sourceNode, options.stub, lang)
    : targetNode;
}

function makeStubValue(sourceValue, stubMode, lang) {
  if (isPlainObject(sourceValue)) {
    const out = {};
    for (const [key, value] of Object.entries(sourceValue)) {
      out[key] = makeStubValue(value, stubMode, lang);
    }
    return out;
  }

  if (Array.isArray(sourceValue)) {
    return sourceValue.map((item) => makeStubValue(item, stubMode, lang));
  }

  if (typeof sourceValue !== "string") {
    return sourceValue;
  }

  if (stubMode === "copy") {
    return sourceValue;
  }

  if (stubMode === "empty") {
    return "";
  }

  return `[TODO:${lang}] ${sourceValue}`;
}

function stableJsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function printUsage() {
  console.log(`Usage:\n  npm run i18n:locale -- --lang <language-tag> [options]\n\nOptions:\n  --source <lang>           Source locale directory under src/locales (default: en)\n  --stub <mode>             Missing-key behavior: copy | todo | empty (default: todo)\n  --overwrite-existing      Replace existing translated values with stub values\n  --prune                   Remove keys not present in source locale\n  --dry-run                 Show what would change without writing files\n  -h, --help                Show this help\n\nExamples:\n  npm run i18n:locale -- --lang es\n  npm run i18n:locale -- --lang fr --stub copy\n  npm run i18n:locale -- --lang de --dry-run\n`);
}

function fail(message) {
  console.error(`i18n-scaffold-locale: ${message}`);
  process.exit(1);
}

main().catch((error) => {
  fail(String(error));
});
