#!/bin/zsh
set -euo pipefail

ROOT="frontend"

write() {
  local file="$1"
  mkdir -p "$(dirname "$file")"
  cat > "$file"
}

write "$ROOT/package.json" <<'EOF'
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@tanstack/react-query": "latest",
    "axios": "latest",
    "react": "latest",
    "react-dom": "latest",
    "react-router-dom": "latest",
    "zustand": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "@vitejs/plugin-react": "latest",
    "typescript": "latest",
    "vite": "latest"
  }
}
EOF

write "$ROOT/tsconfig.json" <<'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
EOF

write "$ROOT/tsconfig.node.json" <<'EOF'
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
EOF

write "$ROOT/vite.config.ts" <<'EOF'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()]
});
EOF

write "$ROOT/index.html" <<'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Frontend</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

write "$ROOT/.env.example" <<'EOF'
VITE_API_BASE_URL=http://localhost:8080/api/v1
EOF

write "$ROOT/src/main.tsx" <<'EOF'
import React from "react";
import ReactDOM from "react-dom/client";
import Providers from "./app/providers";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Providers />
  </React.StrictMode>
);
EOF

write "$ROOT/src/App.tsx" <<'EOF'
import { Outlet } from "react-router-dom";
import AppShell from "./components/layout/AppShell";

export default function App() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
EOF

write "$ROOT/src/app/config.ts" <<'EOF'
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api/v1"
};
EOF

write "$ROOT/src/app/queryClient.ts" <<'EOF'
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient();
EOF

write "$ROOT/src/app/authStore.ts" <<'EOF'
import { create } from "zustand";

type AuthState = {
  token: string | null;
  setToken: (token: string | null) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem("token"),
  setToken: (token) => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
    set({ token });
  },
  logout: () => {
    localStorage.removeItem("token");
    set({ token: null });
  }
}));
EOF

write "$ROOT/src/app/providers.tsx" <<'EOF'
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { queryClient } from "./queryClient";
import { router } from "./router";

export default function Providers() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
EOF

write "$ROOT/src/app/router.tsx" <<'EOF'
import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import LoginPage from "../features/auth/LoginPage";
import DashboardPage from "../features/dashboard/DashboardPage";
import PeopleListPage from "../features/people/PeopleListPage";
import PersonDetailPage from "../features/people/PersonDetailPage";
import CollaboratorListPage from "../features/collaborators/CollaboratorListPage";
import CollaboratorDetailPage from "../features/collaborators/CollaboratorDetailPage";
import WorkPeriodsPage from "../features/planning/WorkPeriodsPage";
import WorkPeriodDetailPage from "../features/planning/WorkPeriodDetailPage";
import MineProductionPage from "../features/production/MineProductionPage";
import GoldPricesPage from "../features/gold-prices/GoldPricesPage";
import PriceListPage from "../features/price-list/PriceListPage";
import ExpensesPage from "../features/expenses/ExpensesPage";
import ExpenseEntryPage from "../features/expenses/ExpenseEntryPage";
import CurrentAccountPage from "../features/current-accounts/CurrentAccountPage";
import LedgerEntriesPage from "../features/current-accounts/LedgerEntriesPage";
import ReportsPage from "../features/reports/ReportsPage";
import SettingsPage from "../features/settings/SettingsPage";
import ReferenceDataPage from "../features/settings/ReferenceDataPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "login", element: <LoginPage /> },
      { path: "people", element: <PeopleListPage /> },
      { path: "people/:id", element: <PersonDetailPage /> },
      { path: "collaborators", element: <CollaboratorListPage /> },
      { path: "collaborators/:id", element: <CollaboratorDetailPage /> },
      { path: "planning", element: <WorkPeriodsPage /> },
      { path: "planning/:id", element: <WorkPeriodDetailPage /> },
      { path: "production", element: <MineProductionPage /> },
      { path: "gold-prices", element: <GoldPricesPage /> },
      { path: "price-list", element: <PriceListPage /> },
      { path: "expenses", element: <ExpensesPage /> },
      { path: "expenses/new", element: <ExpenseEntryPage /> },
      { path: "current-accounts", element: <CurrentAccountPage /> },
      { path: "current-accounts/ledger", element: <LedgerEntriesPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "settings/reference-data", element: <ReferenceDataPage /> }
    ]
  }
]);
EOF

write "$ROOT/src/api/client.ts" <<'EOF'
import axios from "axios";
import { config } from "../app/config";
import { useAuthStore } from "../app/authStore";

export const apiClient = axios.create({
  baseURL: config.apiBaseUrl
});

apiClient.interceptors.request.use((request) => {
  const token = useAuthStore.getState().token;
  if (token) request.headers.Authorization = `Bearer ${token}`;
  return request;
});
EOF

for f in auth people collaborators referenceData workPeriods planning mineProduction goldPrices priceList expenses currentAccounts reports; do
  write "$ROOT/src/api/$f.api.ts" <<EOF
import { apiClient } from "./client";

export const ${f}Api = {
  list: async () => {
    const response = await apiClient.get("/");
    return response.data;
  }
};
EOF
done

for f in api auth people collaborators referenceData planning production expenses currentAccounts reports; do
  write "$ROOT/src/types/$f.ts" <<EOF
export type ${f} = Record<string, unknown>;
EOF
done

write "$ROOT/src/components/layout/AppShell.tsx" <<'EOF'
import TopBar from "./TopBar";
import SideNav from "./SideNav";

type Props = {
  children: React.ReactNode;
};

export default function AppShell({ children }: Props) {
  return (
    <div>
      <TopBar />
      <div style={{ display: "flex" }}>
        <SideNav />
        <main style={{ padding: 24, flex: 1 }}>{children}</main>
      </div>
    </div>
  );
}
EOF

write "$ROOT/src/components/layout/TopBar.tsx" <<'EOF'
export default function TopBar() {
  return <header style={{ padding: 16, borderBottom: "1px solid #ddd" }}>Mina Carara</header>;
}
EOF

write "$ROOT/src/components/layout/SideNav.tsx" <<'EOF'
import { Link } from "react-router-dom";

export default function SideNav() {
  return (
    <nav style={{ width: 220, padding: 16 }}>
      <Link to="/">Dashboard</Link><br />
      <Link to="/people">People</Link><br />
      <Link to="/collaborators">Collaborators</Link><br />
      <Link to="/planning">Planning</Link><br />
      <Link to="/expenses">Expenses</Link><br />
      <Link to="/current-accounts">Current Accounts</Link><br />
      <Link to="/reports">Reports</Link><br />
      <Link to="/settings">Settings</Link>
    </nav>
  );
}
EOF

write "$ROOT/src/components/layout/BottomNav.tsx" <<'EOF'
export default function BottomNav() {
  return <nav />;
}
EOF

write "$ROOT/src/components/layout/PageHeader.tsx" <<'EOF'
type Props = { title: string; subtitle?: string };

export default function PageHeader({ title, subtitle }: Props) {
  return (
    <header>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </header>
  );
}
EOF

for f in TextField SelectField DateField MoneyField GoldField; do
  write "$ROOT/src/components/forms/$f.tsx" <<EOF
type Props = {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
};

export default function $f({ label, value = "", onChange }: Props) {
  return (
    <label>
      {label && <span>{label}</span>}
      <input value={value} onChange={(event) => onChange?.(event.target.value)} />
    </label>
  );
}
EOF
done

write "$ROOT/src/components/forms/FormActions.tsx" <<'EOF'
type Props = { onCancel?: () => void };

export default function FormActions({ onCancel }: Props) {
  return (
    <div>
      <button type="submit">Save</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </div>
  );
}
EOF

for f in SummaryCard BalanceCard CollaboratorCard LedgerEntryCard; do
  write "$ROOT/src/components/cards/$f.tsx" <<EOF
type Props = {
  title?: string;
  children?: React.ReactNode;
};

export default function $f({ title, children }: Props) {
  return (
    <section style={{ border: "1px solid #ddd", padding: 16, borderRadius: 8 }}>
      {title && <h3>{title}</h3>}
      {children}
    </section>
  );
}
EOF
done

write "$ROOT/src/components/tables/DataTable.tsx" <<'EOF'
export default function DataTable() {
  return <table />;
}
EOF

write "$ROOT/src/components/tables/MobileListTable.tsx" <<'EOF'
export default function MobileListTable() {
  return <div />;
}
EOF

write "$ROOT/src/components/tables/Pagination.tsx" <<'EOF'
export default function Pagination() {
  return <nav />;
}
EOF

for f in Loading EmptyState ErrorAlert ConfirmDialog; do
  write "$ROOT/src/components/feedback/$f.tsx" <<EOF
export default function $f() {
  return <div>$f</div>;
}
EOF
done

write "$ROOT/src/components/guards/RequireAuth.tsx" <<'EOF'
type Props = { children: React.ReactNode };

export default function RequireAuth({ children }: Props) {
  return <>{children}</>;
}
EOF

write "$ROOT/src/components/guards/RequireRole.tsx" <<'EOF'
type Props = { children: React.ReactNode };

export default function RequireRole({ children }: Props) {
  return <>{children}</>;
}
EOF

page() {
  local file="$1"
  local name="$2"
  write "$file" <<EOF
import PageHeader from "../../components/layout/PageHeader";

export default function $name() {
  return <PageHeader title="$name" />;
}
EOF
}

page "$ROOT/src/features/auth/LoginPage.tsx" LoginPage
page "$ROOT/src/features/dashboard/DashboardPage.tsx" DashboardPage
page "$ROOT/src/features/people/PeopleListPage.tsx" PeopleListPage
page "$ROOT/src/features/people/PersonDetailPage.tsx" PersonDetailPage
page "$ROOT/src/features/collaborators/CollaboratorListPage.tsx" CollaboratorListPage
page "$ROOT/src/features/collaborators/CollaboratorDetailPage.tsx" CollaboratorDetailPage
page "$ROOT/src/features/planning/WorkPeriodsPage.tsx" WorkPeriodsPage
page "$ROOT/src/features/planning/WorkPeriodDetailPage.tsx" WorkPeriodDetailPage
page "$ROOT/src/features/production/MineProductionPage.tsx" MineProductionPage
page "$ROOT/src/features/gold-prices/GoldPricesPage.tsx" GoldPricesPage
page "$ROOT/src/features/price-list/PriceListPage.tsx" PriceListPage
page "$ROOT/src/features/expenses/ExpensesPage.tsx" ExpensesPage
page "$ROOT/src/features/expenses/ExpenseEntryPage.tsx" ExpenseEntryPage
page "$ROOT/src/features/current-accounts/CurrentAccountPage.tsx" CurrentAccountPage
page "$ROOT/src/features/current-accounts/LedgerEntriesPage.tsx" LedgerEntriesPage
page "$ROOT/src/features/reports/ReportsPage.tsx" ReportsPage
page "$ROOT/src/features/settings/SettingsPage.tsx" SettingsPage
page "$ROOT/src/features/settings/ReferenceDataPage.tsx" ReferenceDataPage

for file in \
  "$ROOT/src/features/dashboard/DashboardCards.tsx" \
  "$ROOT/src/features/people/PersonForm.tsx" \
  "$ROOT/src/features/collaborators/CollaboratorForm.tsx" \
  "$ROOT/src/features/collaborators/ExtendJourneyDialog.tsx" \
  "$ROOT/src/features/collaborators/FinishJourneyDialog.tsx" \
  "$ROOT/src/features/collaborators/ProjectionPanel.tsx" \
  "$ROOT/src/features/planning/PlanTab.tsx" \
  "$ROOT/src/features/planning/InformTab.tsx" \
  "$ROOT/src/features/planning/AccrualTab.tsx" \
  "$ROOT/src/features/planning/PlanItemEditor.tsx" \
  "$ROOT/src/features/production/MineProductionForm.tsx" \
  "$ROOT/src/features/gold-prices/GoldPriceForm.tsx" \
  "$ROOT/src/features/price-list/PriceListItemForm.tsx" \
  "$ROOT/src/features/price-list/PricePreview.tsx" \
  "$ROOT/src/features/expenses/ExpenseForm.tsx" \
  "$ROOT/src/features/expenses/ExpenseSummaryPanel.tsx" \
  "$ROOT/src/features/expenses/ExpenseLineItems.tsx" \
  "$ROOT/src/features/expenses/RevertExpenseDialog.tsx" \
  "$ROOT/src/features/current-accounts/CurrentAccountSummary.tsx" \
  "$ROOT/src/features/current-accounts/LedgerEntryList.tsx" \
  "$ROOT/src/features/current-accounts/RevertLedgerEntryDialog.tsx" \
  "$ROOT/src/features/current-accounts/ZeroGoldDialog.tsx" \
  "$ROOT/src/features/current-accounts/CloseJourneyDialog.tsx" \
  "$ROOT/src/features/reports/CollaboratorBalancesReport.tsx" \
  "$ROOT/src/features/reports/JourneysEndingSoonReport.tsx" \
  "$ROOT/src/features/reports/PendingAccrualsReport.tsx" \
  "$ROOT/src/features/reports/MercantileSalesReport.tsx" \
  "$ROOT/src/features/settings/ReferenceDataForm.tsx"; do
  name="$(basename "$file" .tsx)"
  write "$file" <<EOF
export default function $name() {
  return <div>$name</div>;
}
EOF
done

for file in \
  "$ROOT/src/features/auth/useAuth.ts" \
  "$ROOT/src/features/people/usePeople.ts" \
  "$ROOT/src/features/collaborators/useCollaborators.ts" \
  "$ROOT/src/features/planning/usePlanning.ts" \
  "$ROOT/src/features/production/useMineProduction.ts" \
  "$ROOT/src/features/gold-prices/useGoldPrices.ts" \
  "$ROOT/src/features/price-list/usePriceList.ts" \
  "$ROOT/src/features/expenses/useExpenses.ts" \
  "$ROOT/src/features/current-accounts/useCurrentAccounts.ts" \
  "$ROOT/src/features/reports/useReports.ts" \
  "$ROOT/src/features/settings/useReferenceData.ts"; do
  name="$(basename "$file" .ts)"
  write "$file" <<EOF
export function $name() {
  return {};
}
EOF
done

for file in \
  "$ROOT/src/features/auth/authSchemas.ts" \
  "$ROOT/src/features/people/peopleSchemas.ts" \
  "$ROOT/src/features/collaborators/collaboratorSchemas.ts" \
  "$ROOT/src/features/planning/planningSchemas.ts" \
  "$ROOT/src/features/expenses/expenseSchemas.ts"; do
  write "$file" <<'EOF'
import { z } from "zod";

export const baseSchema = z.object({});
EOF
done

write "$ROOT/src/hooks/useDebounce.ts" <<'EOF'
import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
EOF

write "$ROOT/src/hooks/useMediaQuery.ts" <<'EOF'
import { useEffect, useState } from "react";

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}
EOF

write "$ROOT/src/hooks/useToast.ts" <<'EOF'
export function useToast() {
  return {
    success: console.log,
    error: console.error
  };
}
EOF

for f in dates formatters money gold errors; do
  write "$ROOT/src/utils/$f.ts" <<EOF
export {};
EOF
done

write "$ROOT/src/styles/index.css" <<'EOF'
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, sans-serif;
}

a {
  color: inherit;
}
EOF

write "$ROOT/src/styles/tailwind.css" <<'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;
EOF

write "$ROOT/src/test/setup.ts" <<'EOF'
export {};
EOF

write "$ROOT/src/test/test-utils.tsx" <<'EOF'
export {};
EOF

echo "Frontend starter files repaired."
echo "Next:"
echo "  cd frontend"
echo "  npm install"
echo "  npm run build"