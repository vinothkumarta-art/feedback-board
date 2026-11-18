import { db } from "@/db";
import { users } from "@/db/schema";

/** Records a member the first time the app sees them; keeps their email current. */
export async function ensureUser(user: { id: string; email: string }) {
  await db
    .insert(users)
    .values({ id: user.id, email: user.email })
    .onConflictDoUpdate({ target: users.id, set: { email: user.email } });
}
