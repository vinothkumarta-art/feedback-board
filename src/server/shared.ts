import { z } from "zod";

export const STATUSES = [
  "pending",
  "in_review",
  "planned",
  "in_progress",
  "completed",
  "closed",
] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  pending: "Pending",
  in_review: "In Review",
  planned: "Planned",
  in_progress: "In Progress",
  completed: "Completed",
  closed: "Closed",
};

export const ROADMAP_STATUSES = ["planned", "in_progress", "completed"] as const;

export const CHANGELOG_TAGS = ["New Feature", "Improvement", "Bug Fix"];

/** The member acting, from the Gateway's identity. */
export interface Actor {
  id: string;
  email: string;
  admin: boolean;
}

/** Who votes, comments or subscribes: a member, or a customer by email. */
export interface Person {
  key: string;
  userId: string | null;
  name: string;
  email: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function memberPerson(actor: Pick<Actor, "id" | "email">): Person {
  return {
    key: `u:${actor.id}`,
    userId: actor.id,
    name: displayName(actor.email),
    email: actor.email,
  };
}

export function customerPerson(name: string, email: string): Person {
  const normalized = normalizeEmail(email);
  return {
    key: `e:${normalized}`,
    userId: null,
    name: name.trim() || displayName(normalized),
    email: normalized,
  };
}

/** The part of an address before the @, shown where an address must not be. */
export function displayName(email: string): string {
  return email.split("@")[0] ?? email;
}

export const customerInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email").max(254),
});

export const statusSchema = z.enum(STATUSES);

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "add", "can",
  "please", "have", "our", "your", "you", "are", "not", "but", "all", "when",
  "would", "could", "should", "more", "new", "way", "use", "able", "also",
]);

/** The words of a title that count when looking for similar requests. */
export function titleWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length >= 3 && !STOP_WORDS.has(word)),
  );
}

/** Titles sharing the most words with `query` first; none sharing a word. */
export function rankSimilar<T extends { title: string }>(
  query: string,
  candidates: T[],
  limit = 5,
): T[] {
  const words = titleWords(query);
  if (words.size === 0) return [];
  return candidates
    .map((candidate) => {
      let score = 0;
      for (const word of titleWords(candidate.title)) {
        if (words.has(word)) score += 1;
      }
      return { candidate, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}
