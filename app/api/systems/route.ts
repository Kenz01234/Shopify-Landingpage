import { api } from "@/lib/api";
import { createSystem } from "@/lib/systems";

export const POST = api(async ({ req, ctx }) => {
  const body = await req.json().catch(() => null);
  const system = await createSystem(ctx, body);
  return { id: system.id };
});
