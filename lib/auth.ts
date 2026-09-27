import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { claimShopifyOrdersForUser } from "@/lib/billing/shopify";
import { prisma } from "@/lib/db";

/**
 * Authentifizierung mit Better Auth: E-Mail + Passwort (scrypt-Hash), Sessions in der Datenbank,
 * HttpOnly-Cookies. Nach der Registrierung wird automatisch eine eigene Organisation angelegt.
 */
const baseURL = process.env.BETTER_AUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  appName: "Quest Agent",
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [baseURL],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    cookiePrefix: "qa",
    useSecureCookies: baseURL.startsWith("https://"),
  },
  telemetry: { enabled: false },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const org = await prisma.organization.create({ data: { name: `${user.name || "Mein"} Kanalstudio` } });
          await prisma.membership.create({ data: { organizationId: org.id, userId: user.id, role: "owner" } });
          await prisma.auditEvent.create({
            data: { organizationId: org.id, actorType: "user", actorUserId: user.id, action: "account.register", targetType: "user", targetId: user.id },
          });
          // Vorher im Shop gekaufte Pläne übernehmen (nur mit bestätigter E-Mail, siehe lib/billing/shopify.ts)
          await claimShopifyOrdersForUser({ id: user.id, email: user.email, emailVerified: !!user.emailVerified });
        },
      },
      update: {
        after: async (user) => {
          if (user.emailVerified) await claimShopifyOrdersForUser({ id: user.id, email: user.email, emailVerified: true });
        },
      },
    },
  },
  plugins: [nextCookies()],
});
