import vinext from "vinext";
import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const CLOUDFLARE_D1_DATABASE_NAME = "secret-mouse-tickets-prod";
const CLOUDFLARE_D1_DATABASE_ID = "e12a5443-6358-4f93-89d5-cded96860d56";

const { d1, r2 } = hostingConfig;

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  triggers: {
    crons: ["0 10 * * *"],
  },
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: CLOUDFLARE_D1_DATABASE_NAME,
          database_id: CLOUDFLARE_D1_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
  vars: {
    DAILY_PURCHASE_LIMIT: "25",
    FROM_EMAIL: "Secret Mouse Tickets <hello@secretmousetickets.com>",
    GOOGLE_SEARCH_URL:
      "https://www.google.com/search?q=site:disneyevent.com&client=safari&sca_esv=2802dad21c2aa82f&sca_upv=1&hl=en-us&prmd=bsivn&sxsrf=ACQVn09cFK7nJ-G_9_qmduXCndQf3zYNyw:1709145310580&filter=0&biw=393&bih=741&dpr=3#ip=1",
    SEARCH_NORMALIZER_PROVIDER: "serper",
    SQUARE_APPLICATION_ID: "sq0idp-skrChnsqOFISfDV3KK4wVg",
    SQUARE_ENVIRONMENT: "production",
    SQUARE_LOCATION_ID: "LZGZRXXHY8TG0",
    SQUARE_WEBHOOK_NOTIFICATION_URL:
      "https://secretmousetickets.com/api/square/webhook",
  },
};

export default defineConfig({
  plugins: [
    vinext(),
    sites(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
      config: localBindingConfig,
    }),
  ],
});
