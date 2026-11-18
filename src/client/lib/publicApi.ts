import { notFound } from "@tanstack/react-router";

/** Reads a public route; a 404 becomes the route's not-found state. */
export async function getPublic<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { accept: "application/json" } });
  if (response.status === 404) throw notFound();
  if (!response.ok) throw new Error("Couldn't load this page");
  return response.json() as Promise<T>;
}

export async function postPublic<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Something went wrong");
  return data as T;
}

export interface Guest {
  name: string;
  email: string;
}

const KEY = "feedback-guest";

/** The name and email a visitor gave last time, kept in this browser. */
export function loadGuest(): Guest | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "null") as Guest | null;
    return value?.email ? value : null;
  } catch {
    return null;
  }
}

export function saveGuest(guest: Guest) {
  localStorage.setItem(KEY, JSON.stringify(guest));
}

export interface Viewer {
  member: boolean;
  name: string | null;
}

/**
 * Reloads a public page's data. The root route's data comes from a server
 * function that visitors can't call, so it is left as it was.
 */
export function reloadPublic(router: { invalidate: (opts?: { filter?: (match: { routeId: string }) => boolean }) => Promise<void> }) {
  return router.invalidate({ filter: (match) => match.routeId !== "__root__" });
}
