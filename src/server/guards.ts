import { setResponseStatus } from "@tanstack/react-start/server";
import { NotFoundError } from "@/server/errors";
import type { Actor } from "@/server/shared";

export function requireAdmin(actor: Actor) {
  if (actor.admin) return;
  setResponseStatus(403);
  throw new Error("Only admins can do this");
}

/** Answers 404 when the object isn't there or isn't the member's to change. */
export async function refusingMissing<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof NotFoundError) setResponseStatus(404);
    throw error;
  }
}
