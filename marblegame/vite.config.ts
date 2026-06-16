import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/web_toys/marblegame/" : "/",
  server: { host: true },
  optimizeDeps: { exclude: ["@babylonjs/havok"] },
  build: {
    // Bumps the warning limit to 8MB to account for BabylonJS and Havok
    chunkSizeWarningLimit: 8000, 
  },
}));
