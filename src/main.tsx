import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
