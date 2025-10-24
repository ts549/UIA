import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import Inspector from "./components/Inspector.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Inspector>
      <App />
    </Inspector>
  </StrictMode>,
);
