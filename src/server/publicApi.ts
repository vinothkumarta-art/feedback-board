import { env } from "cloudflare:workers";
import { getEveryAppUser } from "@every-app/sdk/server";
import { ZodError } from "zod";
import { NotFoundError } from "@/server/errors";
import { customerInput, customerPerson, memberPerson, type Person } from "@/server/shared";
import { ensureUser } from "@/server/users";

/**
 * The public routes (/p/api/**): anyone may call them. A signed-in member
 * still comes with their identity; anyone else is a guest who names
 * themselves, and gets nothing a member would.
 */
export async function viewerOf(request: Request) {
  const user = await getEveryAppUser(request, env);
  if (!user) return null;
  await ensureUser(user);
  return user;
}

export function viewerSummary(user: Awaited<ReturnType<typeof viewerOf>>) {
  return user ? { member: true, name: memberPerson(user).name } : { member: false, name: null };
}

/** The member, or the guest named in the body. */
export function personFrom(user: Awaited<ReturnType<typeof viewerOf>>, body: unknown): Person {
  if (user) return memberPerson(user);
  const guest = customerInput.parse(body);
  return customerPerson(guest.name, guest.email);
}

export async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export const notFound = () => Response.json({ error: "Not found" }, { status: 404 });

/** Turns bad input into 400 and a missing object into 404. */
export async function handle(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ZodError)
      return Response.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    if (error instanceof NotFoundError) return notFound();
    throw error;
  }
}

