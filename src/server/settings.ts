import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";

const ROADMAP_PUBLIC = "roadmap_public";

export async function isRoadmapPublic(): Promise<boolean> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, ROADMAP_PUBLIC));
  return row ? row.value === "true" : true;
}

export async function setRoadmapPublic(value: boolean): Promise<boolean> {
  await db
    .insert(appSettings)
    .values({ key: ROADMAP_PUBLIC, value: String(value) })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: String(value) },
    });
  return value;
}
