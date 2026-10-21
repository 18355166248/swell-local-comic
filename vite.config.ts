import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 1420,
    // Tauri devUrl must stay on this port; fail instead of silently switching.
    strictPort: true,
  },
  define: {
    global: "globalThis",
  },
});
