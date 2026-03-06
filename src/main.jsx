import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import LunaSleep from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LunaSleep />
  </StrictMode>
);
