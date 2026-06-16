import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/web_toys/marblegame/" : "/",
  server: { host: true },
  optimizeDeps: { exclude: ["@babylonjs/havok"] },
}));
