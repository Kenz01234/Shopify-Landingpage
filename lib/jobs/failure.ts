import type { JobStatus, ProductionJob } from "@/generated/prisma/client";
import type { Db } from "@/lib/db";
import { transitionJob } from "@/lib/jobs/service";
import { isDemoMode } from "@/lib/env";

/** Begrenzte Wiederholungen mit exponentiellem Backoff (Demo: Sekunden, Live: Minuten). */
export function backoffMs(attempt: number) {
  const base = isDemoMode() ? 4_000 : 60_000;
  return Math.min(base * 3 ** Math.max(0, attempt - 1), isDemoMode() ? 60_000 : 60 * 60_000);
}

export async function applyFailure(
  db: Db,
  job: Pick<ProductionJob, "id" | "status" | "organizationId" | "attempt" | "maxAttempts">,
  step: JobStatus,
  err: { code: string; message: string; retryable: boolean; provider?: string },
) {
  const attempt = job.attempt + 1;
  const base = {
    attempt,
    lastErrorCode: err.code,
    lastErrorMessage: err.message,
    lockedBy: null,
    lockedUntil: null,
    awaitingExternal: false,
  };
  if (err.retryable && attempt < job.maxAttempts) {
    const wait = backoffMs(attempt);
    await transitionJob(db, job, "retry_scheduled", `${err.message} – neuer Versuch ${attempt + 1}/${job.maxAttempts} in ${Math.round(wait / 1000)} s.`, {
      ...base,
      retryStep: step,
      nextRunAt: new Date(Date.now() + wait),
    });
    return "retry" as const;
  }
  await transitionJob(
    db,
    job,
    "failed",
    err.retryable ? `${err.message} – nach ${attempt} Versuchen angehalten.` : `${err.message} – kein automatischer neuer Versuch.`,
    { ...base, failedStep: step, retryStep: null, nextRunAt: null },
  );
  return "failed" as const;
}
