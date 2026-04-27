import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import LoginPage from "../features/auth/LoginPage";
import DashboardPage from "../features/dashboard/DashboardPage";
import ExpensesPage from "../features/expenses/ExpensesPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "login",
        element: <LoginPage />,
      },
      {
        path: "Expenses",
        element: <ExpensesPage />,
      },
    ],
  },
]);