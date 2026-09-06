# Frontend

React/Vite frontend for the Enterprise Remote System.

## Stack

- React
- Typescript
- Vite
- TailCSS

## Run

```bash
cd frontend
npm run dev
```

Then run:

```bash
http://localhost:5173
```
Your frontend changes hot reload through Vite, and backend Go changes restart automatically through `air`.

## i18n Locale Scaffolding

Generate or sync locale namespace files from `src/locales/en` into another language directory:

```bash
cd frontend
npm run i18n:locale -- --lang es
```

Default behavior creates missing files and keys with TODO-prefixed strings, while preserving existing translated values.

Useful options:

```bash
# Copy English values instead of TODO-prefixed values
npm run i18n:locale -- --lang fr --stub copy

# Preview changes without writing files
npm run i18n:locale -- --lang de --dry-run

# Force refresh all existing values from source behavior
npm run i18n:locale -- --lang pt-BR --overwrite-existing --stub copy

# Remove keys that no longer exist in the source locale
npm run i18n:locale -- --lang pt-BR --prune
```

## i18n Config Sync

After creating or updating locale directories/files, sync `src/app/i18n.ts` imports/resources/supported languages automatically:

```bash
cd frontend
npm run i18n:sync-config
```

Dry run:

```bash
npm run i18n:sync-config -- --dry-run
```

One-command flow for adding a locale and syncing config:

```bash
npm run i18n:add-locale -- --lang es
```