import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    plugins: [cloudflare(), react()],
    resolve: {
      alias: {
        // Resolve @tldraw modules from this project's node_modules
        // This is needed because shared folder imports @tldraw modules
        "@tldraw/editor": path.resolve(
          __dirname,
          "node_modules/@tldraw/editor"
        ),
        "@tldraw/tldraw": path.resolve(
          __dirname,
          "node_modules/@tldraw/tldraw"
        ),
        "@tldraw/tlschema": path.resolve(
          __dirname,
          "node_modules/@tldraw/tlschema"
        ),
        "@tldraw/validate": path.resolve(
          __dirname,
          "node_modules/@tldraw/validate"
        ),
      },
    },
  };
});
