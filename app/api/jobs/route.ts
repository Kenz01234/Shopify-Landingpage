import { z } from "zod";
import { api, parseBody } from "@/lib/api";
import { createManualJob } from "@/lib/jobs/service";

const schema = z.object({
  systemId: z.string().min(1),
  format: z.enum(["longform", "short"]),
  clientKey: z.string().uuid(),
  demoScenario: z.enum(["success", "transient_failure", "permanent_failure", "instagram_failure"]).optional(),
});

export const POST = api(async ({ req, ctx }) => {
  const body = await parseBody(req, schema);
  const { job, created } = await createManualJob(ctx, body);
  return { id: job.id, created };
});
