import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

/** Members the app has seen, keyed by the Gateway's user id. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: createdAt(),
});

export const boards = sqliteTable("boards", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  createdAt: createdAt(),
});

export const requests = sqliteTable(
  "requests",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    // A member who posted it, or null for a customer (guest or on-behalf).
    authorUserId: text("author_user_id"),
    authorName: text("author_name").notNull(),
    authorEmail: text("author_email").notNull(),
    // "board" (posted on the board) or "on_behalf" (a member for a customer).
    source: text("source").notNull(),
    postedByUserId: text("posted_by_user_id"),
    status: text("status").notNull().default("pending"),
    mergedIntoId: text("merged_into_id"),
    createdAt: createdAt(),
  },
  (t) => [index("requests_board_idx").on(t.boardId)],
);

export const votes = sqliteTable(
  "votes",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    // "u:<user id>" for a member, "e:<normalized email>" for a customer.
    voterKey: text("voter_key").notNull(),
    userId: text("user_id"),
    name: text("name").notNull().default(""),
    email: text("email").notNull(),
    addedByUserId: text("added_by_user_id"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("votes_request_voter").on(t.requestId, t.voterKey)],
);

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    authorUserId: text("author_user_id"),
    authorName: text("author_name").notNull(),
    authorEmail: text("author_email").notNull(),
    internal: integer("internal", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: text("updated_at"),
  },
  (t) => [index("comments_request_idx").on(t.requestId)],
);

/** The request's timeline: status changes and merges. */
export const requestEvents = sqliteTable(
  "request_events",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    // "status" or "merge"
    kind: text("kind").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    detail: text("detail"),
    actorUserId: text("actor_user_id").notNull(),
    actorName: text("actor_name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("request_events_request_idx").on(t.requestId)],
);

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    // Same keys as votes.
    subscriberKey: text("subscriber_key").notNull(),
    userId: text("user_id"),
    email: text("email").notNull(),
    // The unsubscribe link's secret.
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("subscriptions_request_subscriber").on(
      t.requestId,
      t.subscriberKey,
    ),
  ],
);

export const changelogEntries = sqliteTable("changelog_entries", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  tag: text("tag").notNull(),
  // Null: a draft. In the future: scheduled. Otherwise published.
  publishAt: text("publish_at"),
  authorUserId: text("author_user_id").notNull(),
  createdAt: createdAt(),
  updatedAt: text("updated_at"),
});

export const changelogLinks = sqliteTable(
  "changelog_links",
  {
    entryId: text("entry_id")
      .notNull()
      .references(() => changelogEntries.id, { onDelete: "cascade" }),
    requestId: text("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.requestId] })],
);

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
