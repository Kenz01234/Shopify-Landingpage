import { api, parseBody } from "@/lib/api";
import { cancelJob, retryJob } from "@/lib/jobs/service";
import { approve, approveSchema, changesSchema, editSchema, reject, rejectSchema, requestChanges, saveEdit } from "@/lib/review";
import { freeSlotsForJob } from "@/lib/publishing";
import { notFound } from "@/lib/errors";

export const GET = api<{ id: string; action: string }>(async ({ ctx, params }) => {
  if (params.action === "slots") return freeSlotsForJob(ctx, params.id, 8);
  throw notFound("Aktion");
});

export const POST = api<{ id: string; action: string }>(async ({ req, ctx, params }) => {
  switch (params.action) {
    case "cancel":
      return { id: await cancelJob(ctx, params.id) };
    case "retry":
      return { id: await retryJob(ctx, params.id) };
    case "approve":
      return approve(ctx, params.id, await parseBody(req, approveSchema));
    case "request-changes":
      return requestChanges(ctx, params.id, await parseBody(req, changesSchema));
    case "reject":
      return reject(ctx, params.id, await parseBody(req, rejectSchema));
    case "versions":
      return saveEdit(ctx, params.id, await parseBody(req, editSchema));
    default:
      throw notFound("Aktion");
  }
});
