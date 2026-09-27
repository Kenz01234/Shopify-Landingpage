import { api } from "@/lib/api";
import { updateSystem } from "@/lib/systems";

export const PATCH = api<{ id: string }>(async ({ req, ctx, params }) => {
  const body = await req.json().catch(() => null);
  const s = await updateSystem(ctx, params.id, body);
  return { id: s.id, configVersion: s.configVersion };
});
