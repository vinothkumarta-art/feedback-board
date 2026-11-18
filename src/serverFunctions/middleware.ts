import { createMiddleware } from "@tanstack/react-start";
import { isAdmin } from "@every-app/sdk/server";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import type { Actor } from "@/server/shared";
import { ensureUser } from "@/server/users";

/** The signed-in member, recorded on first sight, with their admin flag. */
export const memberMiddleware = createMiddleware({ type: "function" })
  .middleware([ensureUserMiddleware])
  .server(async ({ next, context: { user } }) => {
    await ensureUser(user);
    const actor: Actor = { id: user.id, email: user.email, admin: isAdmin(user) };
    return next({ context: { actor } });
  });
