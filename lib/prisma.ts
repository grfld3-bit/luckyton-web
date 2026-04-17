import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL || "";
if (databaseUrl.includes(".internal")) {
  console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
  console.error("CRITICAL CONFIG ERROR: DATABASE_URL is using an internal Railway address.");
  console.error("This will NOT work from the AI Studio preview.");
  console.error("FIX: Go to Railway Dashboard -> Project -> PostgreSQL -> Connect.");
  console.error("Copy the 'Public Connection String' and paste it into your APP variables.");
  console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
}

export const prisma = new PrismaClient({
    log: ['error', 'warn'],
    errorFormat: 'minimal',
});
