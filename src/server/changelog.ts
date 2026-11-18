import { and, desc, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { changelogEntries, changelogLinks, requests } from "@/db/schema";

export const saveEntryInput = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().min(1, "Title is required").max(200),
    body: z.string().max(50000).default(""),
    tag: z.string().trim().min(1, "Pick a tag").max(40),
    requestIds: z.array(z.string()).max(50).default([]),
    // draft: unpublished; publish: public now; schedule: public at `at`; keep: as it was.
    action: z.enum(["draft", "publish", "schedule", "keep"]),
    at: z.string().datetime().optional(),
  })
  .strict()
  .refine((v) => v.action !== "schedule" || v.at !== undefined, "Pick a date and time");

export type EntryState = "draft" | "scheduled" | "published";

export function entryState(publishAt: string | null, now = new Date().toISOString()): EntryState {
  if (!publishAt) return "draft";
  return publishAt > now ? "scheduled" : "published";
}

const voteCount = sql<number>`(select count(*) from votes where votes.request_id = ${requests.id})`.mapWith(Number);

async function linksFor(entryIds: string[]) {
  if (entryIds.length === 0) return new Map<string, { id: string; title: string; status: string; votes: number }[]>();
  const rows = await db
    .select({
      entryId: changelogLinks.entryId,
      id: requests.id,
      title: requests.title,
      status: requests.status,
      votes: voteCount,
    })
    .from(changelogLinks)
    .innerJoin(requests, eq(requests.id, changelogLinks.requestId))
    .where(inArray(changelogLinks.entryId, entryIds));
  const map = new Map<string, { id: string; title: string; status: string; votes: number }[]>();
  for (const { entryId, ...link } of rows) map.set(entryId, [...(map.get(entryId) ?? []), link]);
  return map;
}

/** Every entry, for members. */
export async function listEntries() {
  const rows = await db.select().from(changelogEntries).orderBy(desc(changelogEntries.createdAt));
  const now = new Date().toISOString();
  return rows.map((row) => ({ ...row, state: entryState(row.publishAt, now) }));
}

export async function getEntry(id: string) {
  const [row] = await db.select().from(changelogEntries).where(eq(changelogEntries.id, id));
  if (!row) return null;
  const links = (await linksFor([id])).get(id) ?? [];
  return { ...row, state: entryState(row.publishAt), links };
}

function publishedOnly(now: string) {
  return and(isNotNull(changelogEntries.publishAt), lte(changelogEntries.publishAt, now));
}

/** Published entries, newest first: never drafts or scheduled ones. */
export async function listPublished() {
  const now = new Date().toISOString();
  const rows = await db
    .select()
    .from(changelogEntries)
    .where(publishedOnly(now))
    .orderBy(desc(changelogEntries.publishAt));
  const links = await linksFor(rows.map((r) => r.id));
  return rows.map((row) => publicEntry(row, links.get(row.id) ?? []));
}

export async function getPublished(id: string) {
  const now = new Date().toISOString();
  const [row] = await db
    .select()
    .from(changelogEntries)
    .where(and(eq(changelogEntries.id, id), publishedOnly(now)));
  if (!row) return null;
  return publicEntry(row, (await linksFor([id])).get(id) ?? []);
}

function publicEntry(
  row: typeof changelogEntries.$inferSelect,
  links: { id: string; title: string; status: string; votes: number }[],
) {
  return { id: row.id, title: row.title, body: row.body, tag: row.tag, publishedAt: row.publishAt!, links };
}

export async function saveEntry(authorUserId: string, input: z.infer<typeof saveEntryInput>) {
  const now = new Date().toISOString();
  const existing = input.id ? await getEntry(input.id) : null;
  if (input.id && !existing) throw new Error("No such entry");
  const publishAt =
    input.action === "draft"
      ? null
      : input.action === "publish"
        ? now
        : input.action === "schedule"
          ? new Date(input.at!).toISOString()
          : (existing?.publishAt ?? null);
  const id = existing?.id ?? crypto.randomUUID();
  const linkable = input.requestIds.length
    ? (await db.select({ id: requests.id }).from(requests).where(inArray(requests.id, input.requestIds))).map((r) => r.id)
    : [];
  const fields = { title: input.title, body: input.body, tag: input.tag, publishAt };
  await db.batch([
    existing
      ? db.update(changelogEntries).set({ ...fields, updatedAt: now }).where(eq(changelogEntries.id, id))
      : db.insert(changelogEntries).values({ id, authorUserId, ...fields }),
    db.delete(changelogLinks).where(eq(changelogLinks.entryId, id)),
    ...linkable.map((requestId) => db.insert(changelogLinks).values({ entryId: id, requestId })),
  ]);
  return { id, state: entryState(publishAt) };
}

export async function deleteEntry(id: string) {
  const [row] = await db.delete(changelogEntries).where(eq(changelogEntries.id, id)).returning({ id: changelogEntries.id });
  if (!row) throw new Error("No such entry");
  return row;
}
