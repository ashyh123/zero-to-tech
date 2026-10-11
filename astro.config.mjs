import { defineConfig } from "astro/config";
import { loadEnv } from "vite";
const env = loadEnv(process.env.NODE_ENV || "production", process.cwd(), [
  "SITE_URL",
  "RSS_ENABLED",
]);
if (!process.env.SITE_URL && env.SITE_URL) process.env.SITE_URL = env.SITE_URL;
import tailwindcss from "@tailwindcss/vite";
if (process.env.RSS_ENABLED === undefined && env.RSS_ENABLED !== undefined) {
  process.env.RSS_ENABLED = env.RSS_ENABLED;
}
export default defineConfig({
  integrations: [
    {
      name: "optional-rss",
      hooks: {
        "astro:config:setup": ({ injectRoute }) => {
          if (process.env.RSS_ENABLED === "true") {
            injectRoute({
              pattern: "/rss.xml",
              entrypoint: "./src/endpoints/rss.ts",
              prerender: true,
            });
          }
        },
      },
    },
  ],
  output: "static",
  outDir: "./out",
  build: { format: "file" },
  server: { host: "127.0.0.1", port: 3000 },
  vite: { plugins: [tailwindcss()] },
});
