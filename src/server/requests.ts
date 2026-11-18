import { and, asc, desc, eq, inArray, isNull, like, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { db } from "@/db";
import {
  boards,
  comments,
  requestEvents,
  requests,
  subscriptions,
  votes,
} from "@/db/schema";
import {
  STATUS_LABELS,
  displayName,
  rankSimilar,
  statusSchema,
  type Actor,
  type Person,
  type Status,
} from "@/server/shared";

import { NotFoundError } from "@/server/errors";

export { NotFoundError };

export const listInput = z.object({
  boardId: z.string().optional(),
  status: statusSchema.optional(),
  q: z.string().trim().max(200).optional(),
  sort: z.enum(["votes", "newest"]).default("votes"),
});
export type ListFilters = z.infer<typeof listInput>;

export const requestFields = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(5000).default(""),
});

export const commentBody = z.string().trim().min(1, "Write a comment").max(5000);

const voteCount = sql<number>`(select count(*) from votes where votes.request_id = ${requests.id})`.mapWith(Number);
const commentCount = sql<number>`(select count(*) from comments where comments.request_id = ${requests.id} and comments.internal = 0)`.mapWith(Number);

const summary = {
  id: requests.id,
  title: requests.title,
  status: requests.status,
  createdAt: requests.createdAt,
  votes: voteCount,
  comments: commentCount,
  boardName: boards.name,
  boardSlug: boards.slug,
};

export type RequestSummary = {
  id: string;
  title: string;
  status: Status;
  createdAt: string;
  votes: number;
  comments: number;
  boardName: string;
  boardSlug: string;
};

/** Open (not merged) requests, filtered and sorted. */
export async function listRequests(filters: ListFilters): Promise<RequestSummary[]> {
  const where = [isNull(requests.mergedIntoId)];
  if (filters.boardId) where.push(eq(requests.boardId, filters.boardId));
  if (filters.status) where.push(eq(requests.status, filters.status));
  if (filters.q) where.push(like(requests.title, `%${filters.q.replace(/[%_]/g, "")}%`));
  const rows = await db
    .select(summary)
    .from(requests)
    .innerJoin(boards, eq(boards.id, requests.boardId))
    .where(and(...where))
    .orderBy(
      ...(filters.sort === "newest"
        ? [desc(requests.createdAt), desc(requests.id)]
        : [desc(voteCount), desc(requests.createdAt)]),
    );
  return rows as RequestSummary[];
}

export async function listByStatuses(statuses: readonly Status[], boardId?: string) {
  const where = [isNull(requests.mergedIntoId), inArray(requests.status, [...statuses])];
  if (boardId) where.push(eq(requests.boardId, boardId));
  const rows = await db
    .select(summary)
    .from(requests)
    .innerJoin(boards, eq(boards.id, requests.boardId))
    .where(and(...where))
    .orderBy(desc(voteCount), desc(requests.createdAt));
  return rows as RequestSummary[];
}

export async function similarRequests(boardId: string, query: string) {
  const rows = await db
    .select({ id: requests.id, title: requests.title, status: requests.status, votes: voteCount })
    .from(requests)
    .where(and(eq(requests.boardId, boardId), isNull(requests.mergedIntoId)));
  return rankSimilar(query, rows);
}

/** One request with everything a member may see, or null. */
export async function getRequestRow(id: string) {
  const [row] = await db
    .select({
      ...summary,
      boardId: requests.boardId,
      description: requests.description,
      authorUserId: requests.authorUserId,
      authorName: requests.authorName,
      authorEmail: requests.authorEmail,
      source: requests.source,
      mergedIntoId: requests.mergedIntoId,
    })
    .from(requests)
    .innerJoin(boards, eq(boards.id, requests.boardId))
    .where(eq(requests.id, id));
  return row ? { ...row, status: row.status as Status } : null;
}

export async function listComments(requestId: string, { includeInternal }: { includeInternal: boolean }) {
  const where = [eq(comments.requestId, requestId)];
  if (!includeInternal) where.push(eq(comments.internal, false));
  return db
    .select()
    .from(comments)
    .where(and(...where))
    .orderBy(asc(comments.createdAt), asc(comments.id));
}

export function listEvents(requestId: string) {
  return db
    .select()
    .from(requestEvents)
    .where(eq(requestEvents.requestId, requestId))
    .orderBy(asc(requestEvents.createdAt), asc(requestEvents.id));
}

function subscribeStatement(requestId: string, person: Person) {
  return db
    .insert(subscriptions)
    .values({
      id: crypto.randomUUID(),
      requestId,
      subscriberKey: person.key,
      userId: person.userId,
      email: person.email,
      token: crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", ""),
    })
    .onConflictDoNothing();
}

async function openRequest(id: string) {
  const [row] = await db
    .select({ id: requests.id, status: requests.status, title: requests.title, mergedIntoId: requests.mergedIntoId })
    .from(requests)
    .where(eq(requests.id, id));
  if (!row || row.mergedIntoId) throw new NotFoundError("No such request");
  return row;
}

export async function createRequest(input: {
  boardId: string;
  title: string;
  description: string;
  author: Person;
  source: "board" | "on_behalf";
  postedByUserId: string | null;
}): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(requests).values({
      id,
      boardId: input.boardId,
      title: input.title,
      description: input.description,
      authorUserId: input.author.userId,
      authorName: input.author.name,
      authorEmail: input.author.email,
      source: input.source,
      postedByUserId: input.postedByUserId,
    }),
    subscribeStatement(id, input.author),
  ]);
  return { id };
}

async function countVotes(requestId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(votes)
    .where(eq(votes.requestId, requestId));
  return row?.n ?? 0;
}

export async function hasVoted(requestId: string, key: string) {
  const [row] = await db
    .select({ id: votes.id })
    .from(votes)
    .where(and(eq(votes.requestId, requestId), eq(votes.voterKey, key)));
  return Boolean(row);
}

/** Voting again takes the vote back. */
export async function toggleVote(requestId: string, voter: Person) {
  await openRequest(requestId);
  const removed = await db
    .delete(votes)
    .where(and(eq(votes.requestId, requestId), eq(votes.voterKey, voter.key)))
    .returning({ id: votes.id });
  if (removed.length === 0) await addVote(requestId, voter, null);
  return { voted: removed.length === 0, votes: await countVotes(requestId) };
}

/** Adds a vote unless this person already has one. */
export async function addVote(requestId: string, voter: Person, addedByUserId: string | null) {
  await openRequest(requestId);
  await db.batch([
    db
      .insert(votes)
      .values({
        id: crypto.randomUUID(),
        requestId,
        voterKey: voter.key,
        userId: voter.userId,
        name: voter.name,
        email: voter.email,
        addedByUserId,
      })
      .onConflictDoNothing(),
    subscribeStatement(requestId, voter),
  ]);
  return { voted: true, votes: await countVotes(requestId) };
}

export async function addComment(requestId: string, author: Person, body: string, internal: boolean) {
  await openRequest(requestId);
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(comments).values({
      id,
      requestId,
      body,
      internal,
      authorUserId: author.userId,
      authorName: author.name,
      authorEmail: author.email,
    }),
    subscribeStatement(requestId, author),
  ]);
  return { id };
}

/** Only the member who wrote it may edit it. */
export async function editComment(actor: Actor, id: string, body: string) {
  const [row] = await db
    .update(comments)
    .set({ body, updatedAt: new Date().toISOString() })
    .where(and(eq(comments.id, id), eq(comments.authorUserId, actor.id)))
    .returning({ id: comments.id });
  if (!row) throw new NotFoundError("You can only edit your own comments");
  return row;
}

/** The author or an admin may delete it. */
export async function deleteComment(actor: Actor, id: string) {
  const where = actor.admin
    ? eq(comments.id, id)
    : and(eq(comments.id, id), eq(comments.authorUserId, actor.id));
  const [row] = await db.delete(comments).where(where).returning({ id: comments.id });
  if (!row) throw new NotFoundError("You can only delete your own comments");
  return row;
}

export async function isFollowing(requestId: string, actor: Actor) {
  const [row] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.requestId, requestId), eq(subscriptions.subscriberKey, `u:${actor.id}`)));
  return Boolean(row);
}

export async function setFollowing(requestId: string, person: Person, follow: boolean) {
  await openRequest(requestId);
  if (follow) await subscribeStatement(requestId, person);
  else
    await db
      .delete(subscriptions)
      .where(and(eq(subscriptions.requestId, requestId), eq(subscriptions.subscriberKey, person.key)));
  return { following: follow };
}

export async function unsubscribe(token: string) {
  const [row] = await db
    .delete(subscriptions)
    .where(eq(subscriptions.token, token))
    .returning({ requestId: subscriptions.requestId });
  return row ?? null;
}

/**
 * Changes the status and records it on the timeline. Returns who to tell
 * (everyone subscribed but the actor), or null when nothing changed.
 */
export async function changeStatus(actor: Actor, requestId: string, status: Status) {
  const current = await openRequest(requestId);
  if (current.status === status) return null;
  await db.batch([
    db.update(requests).set({ status }).where(eq(requests.id, requestId)),
    db.insert(requestEvents).values({
      id: crypto.randomUUID(),
      requestId,
      kind: "status",
      fromStatus: current.status,
      toStatus: status,
      actorUserId: actor.id,
      actorName: displayName(actor.email),
    }),
  ]);
  const subscribers = await db
    .select({ email: subscriptions.email, key: subscriptions.subscriberKey, token: subscriptions.token })
    .from(subscriptions)
    .where(eq(subscriptions.requestId, requestId));
  const actorEmail = actor.email.toLowerCase();
  return {
    title: current.title,
    statusLabel: STATUS_LABELS[status],
    recipients: subscribers.filter(
      (s) => s.key !== `u:${actor.id}` && s.email.toLowerCase() !== actorEmail,
    ),
  };
}

/** Folds a duplicate into the original: votes (each person once), comments, subscribers and links move. */
export async function mergeRequest(actor: Actor, duplicateId: string, originalId: string) {
  if (duplicateId === originalId) throw new Error("Pick a different request");
  const duplicate = await openRequest(duplicateId);
  await openRequest(originalId);
  const d1 = env.DB;
  const move = (statement: string) => d1.prepare(statement).bind(originalId, duplicateId);
  const drop = (statement: string) => d1.prepare(statement).bind(duplicateId);
  // One batch, so a merge happens whole or not at all.
  await d1.batch([
    move("update or ignore votes set request_id = ?1 where request_id = ?2"),
    drop("delete from votes where request_id = ?1"),
    move("update comments set request_id = ?1 where request_id = ?2"),
    move("update or ignore subscriptions set request_id = ?1 where request_id = ?2"),
    drop("delete from subscriptions where request_id = ?1"),
    move("update or ignore changelog_links set request_id = ?1 where request_id = ?2"),
    drop("delete from changelog_links where request_id = ?1"),
    move("update requests set merged_into_id = ?1 where merged_into_id = ?2"),
    move("update requests set merged_into_id = ?1 where id = ?2"),
    d1
      .prepare(
        "insert into request_events (id, request_id, kind, detail, actor_user_id, actor_name) values (?1, ?2, 'merge', ?3, ?4, ?5)",
      )
      .bind(crypto.randomUUID(), originalId, duplicate.title, actor.id, displayName(actor.email)),
  ]);
  return { id: originalId };
}

export async function deleteRequest(id: string) {
  const [row] = await db.delete(requests).where(eq(requests.id, id)).returning({ id: requests.id });
  if (!row) throw new NotFoundError("No such request");
  return row;
}

/** Requests a changelog entry can link to. */
export function linkableRequests() {
  return db
    .select({ id: requests.id, title: requests.title, status: requests.status })
    .from(requests)
    .where(isNull(requests.mergedIntoId))
    .orderBy(asc(requests.title));
}
