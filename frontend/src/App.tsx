import { Link, Route, Routes } from 'react-router-dom';
import DashboardPage from './features/dashboard/DashboardPage';
import PeopleListPage from './features/people/PeopleListPage';
import SettingsPage from './features/settings/SettingsPage';

export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar"><strong>Mining Accounting</strong></header>
      <main className="content">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/people" element={<PeopleListPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <nav className="bottom-nav">
        <Link to="/">Dashboard</Link>
        <Link to="/people">People</Link>
        <Link to="/settings">Settings</Link>
      </nav>
    </div>
  );
}
