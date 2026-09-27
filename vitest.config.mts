import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    globalSetup: ["tests/unit/global-setup.ts"],
    setupFiles: ["tests/unit/setup-env.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: "test",
      APP_URL: "http://localhost:3000",
      BETTER_AUTH_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-0123456789",
      CREDENTIALS_ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
      DEMO_MODE: "true",
      DEMO_PASSWORD: "TestDemo-Passwort-1",
      DEMO_STEP_MS: "100",
      N8N_SHARED_SECRET: "n8n-test-secret-n8n-test-secret-0123456789",
      STRIPE_WEBHOOK_SECRET: "whsec_test_secret_for_signature_checks",
      STRIPE_PRICE_STARTER: "price_test_starter",
      STRIPE_PRICE_STUDIO: "price_test_studio",
      SHOPIFY_SHOP_DOMAIN: "quest-test.myshopify.com",
      SHOPIFY_WEBHOOK_SECRET: "shopify-test-signing-secret",
      SHOPIFY_PLAN_STARTER: "QA-STARTER",
      SHOPIFY_PLAN_STUDIO: "QA-STUDIO,4711",
    },
  },
});
