import { NavLink, Route, Routes } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import PickPage from "./pages/PickPage";
import StoryPage from "./pages/StoryPage";

export default function App() {
  return (
    <div className="app-shell">
      <header className="topnav">
        <NavLink to="/" className="brand">
          <span className="brand-mark">Graves Continuum</span>
        </NavLink>
        <nav className="nav-links" aria-label="Primary">
          <NavLink to="/pick" className={({ isActive }) => (isActive ? "active" : "")}>
            Try it
          </NavLink>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/pick" element={<PickPage />} />
        <Route path="/story/:id" element={<StoryPage />} />
      </Routes>
    </div>
  );
}
