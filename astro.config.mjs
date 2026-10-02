// @ts-check
import { clickToSource } from "astro-click-to-source";
import { defineConfig, fontProviders } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { SITE_URL } from "./src/consts.ts";
import { isNoindexRoute } from "./src/utils/seo.ts";

export default defineConfig({
  site: SITE_URL,
  integrations: [
    sitemap({
      filter: (page) => !isNoindexRoute(new URL(page).pathname),
    }),
    clickToSource(),
  ],
  fonts: [
    {
      name: "Suisse Intl",
      cssVariable: "--font-suisse-intl",
      provider: fontProviders.local(),
      weights: [400, 500, 600],
      styles: ["normal"],
      options: {
        variants: [
          {
            weight: 400,
            style: "normal",
            src: ["./src/assets/fonts/suisse-intl-regular.woff2"],
          },
          {
            weight: 500,
            style: "normal",
            src: ["./src/assets/fonts/suisse-intl-medium.woff2"],
          },
          {
            weight: 600,
            style: "normal",
            src: ["./src/assets/fonts/suisse-intl-semibold.woff2"],
          },
        ],
      },
    },
  ],
  vite: {
    build: { cssTarget: "safari15.4" },
    server: { watch: { ignored: ["**/screen-instructions/**", "**/.tmp-*/**"] } },
  },
});
