import { inject } from "vitest";

// Muss vor dem ersten Import von lib/db gesetzt sein.
process.env.DATABASE_URL = inject("dbUrl");
