import { NavLink, Route, Routes } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import CohortPage from "./pages/CohortPage";
import PatientPage from "./pages/PatientPage";
import FederatedPage from "./pages/FederatedPage";
import ContractsPage from "./pages/ContractsPage";

export default function App() {
  return (
    <div className="app-shell">
      <header className="topnav">
        <NavLink to="/" className="brand">
          <span className="brand-mark">Graves Continuum</span>
          <span className="brand-sub">UPM</span>
        </NavLink>
        <nav className="nav-links">
          <NavLink to="/cohort" className={({ isActive }) => (isActive ? "active" : "")}>
            Cohort
          </NavLink>
          <NavLink
            to="/federated"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Federated
          </NavLink>
          <NavLink
            to="/contracts"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Value-Based
          </NavLink>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/cohort" element={<CohortPage />} />
        <Route path="/patients/:id" element={<PatientPage />} />
        <Route path="/federated" element={<FederatedPage />} />
        <Route path="/contracts" element={<ContractsPage />} />
      </Routes>
    </div>
  );
}
