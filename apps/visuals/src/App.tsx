import { Route, Routes } from "react-router-dom";
import WhiteboardPage from "./WhiteboardPage";
import DesignMapPage from "./DesignMapPage";
import "./app.css";

export default function App() {
  return (
    <Routes>
      <Route path="/whiteboard/:processId" element={<WhiteboardPage />} />
      <Route path="/design/:processId" element={<DesignMapPage />} />
      <Route
        path="*"
        element={
          <div className="empty">
            <h1>Thomas Visuals</h1>
            <p>
              Open a Process Whiteboard or Solution Design Map link from the feeder.
            </p>
            <p className="paths">
              <code>/whiteboard/:processId</code>
              <code>/design/:processId</code>
            </p>
          </div>
        }
      />
    </Routes>
  );
}
