import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sameOrigin, errorResponse } from "@/lib/api";
import { AppError } from "@/lib/errors";

const schema = z.object({
  name: z.string().trim().min(2, "Bitte deinen Namen angeben").max(80),
  email: z.string().trim().email("Bitte eine gültige E-Mail-Adresse angeben").max(160),
  topic: z.enum(["frage", "demo", "partnerschaft", "sonstiges"]),
  message: z.string().trim().min(10, "Bitte mindestens 10 Zeichen").max(3000),
  website: z.string().max(0).optional(),
});

/** Kontaktformular: wird gespeichert (Admin-Bereich). Es wird lokal keine E-Mail versendet. */
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) throw new AppError("CSRF", "Anfrage von fremder Herkunft abgelehnt.", 403);
    const body = schema.parse(await req.json());
    const recent = await prisma.contactMessage.count({ where: { email: body.email, createdAt: { gt: new Date(Date.now() - 10 * 60_000) } } });
    if (recent >= 3) throw new AppError("RATE_LIMIT", "Bitte versuche es in ein paar Minuten erneut.", 429);
    await prisma.contactMessage.create({ data: { name: body.name, email: body.email, topic: body.topic, message: body.message } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
