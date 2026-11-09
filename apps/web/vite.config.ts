import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { presentationHtml } from "./src/presentation.ts";

export default defineConfig(({ mode }) => ({
  plugins: [react(), {
    name: "explicit-public-presentation",
    transformIndexHtml: (html) => presentationHtml(html, { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env }),
  }],
  server: { host: "127.0.0.1" },
  build: { sourcemap: false },
  test: { environment: "jsdom", include: ["src/**/*.test.tsx"] },
}));
