import devServer from "@hono/vite-dev-server";
import path from "path";
const __dirname = import.meta.dirname;
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import { defineConfig } from "vite";
import { inspectAttr } from "kimi-plugin-inspect-react";

const isDev = process.env.NODE_ENV !== "production";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    devServer({ entry: "api/boot.ts", exclude: [/^\/(?!api\/).*$/] }),
    ...(isDev ? [inspectAttr()] : []),
    react(),
    legacy({
      targets: ["defaults", "not IE 11", "iOS >= 12", "Safari >= 12", "Chrome >= 64", "Edge >= 18"],
      modernTargets: ["edge>=109", "firefox>=115", "chrome>=109", "safari>=15", "chromeAndroid>=109", "iOS>=15"],
      modernPolyfills: false,
      renderLegacyChunks: true,
    }),
  ],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@contracts": path.resolve(__dirname, "./contracts"),
      "@db": path.resolve(__dirname, "./db"),
      "db": path.resolve(__dirname, "./db"),
    },
  },
  envDir: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    target: ["es2020", "edge109", "firefox115", "chrome109", "safari15"],
    cssTarget: ["safari15", "chrome109", "firefox115"],
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"],
          router: ["react-router"],
          query: ["@tanstack/react-query", "@trpc/client", "@trpc/react-query", "superjson"],
          icons: ["lucide-react"],
        },
      },
    },
  },
});
