// envConfig.js

// Detect environment from hostname (client-side detection)
const hostname = typeof window !== "undefined" ? window.location.hostname : "";
export const APP_ENV =
  hostname === "localhost" || hostname === "127.0.0.1" ? "local" :
  hostname.includes("--") ? "preview" :  // Netlify deploy previews
  "prod";

export const API_BASE_URL =
  APP_ENV === "local"
    ? "http://localhost:8888/.netlify/functions"
    : "/.netlify/functions";
