import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { boards } from "@/db/schema";

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Slug is required")
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes");

export const createBoardInput = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80),
    slug,
    description: z.string().trim().max(500).default(""),
  })
  .strict();
export const updateBoardInput = createBoardInput.extend({ id: z.string() });
export const boardIdInput = z.object({ id: z.string() }).strict();

export interface Board {
  id: string;
  name: string;
  slug: string;
  description: string;
}

const shown = {
  id: boards.id,
  name: boards.name,
  slug: boards.slug,
  description: boards.description,
};

export function listBoards(): Promise<Board[]> {
  return db.select(shown).from(boards).orderBy(asc(boards.createdAt), asc(boards.name));
}

export async function getBoardBySlug(value: string): Promise<Board | null> {
  const [board] = await db.select(shown).from(boards).where(eq(boards.slug, value));
  return board ?? null;
}

async function slugTaken(value: string, exceptId?: string) {
  const board = await getBoardBySlug(value);
  return board !== null && board.id !== exceptId;
}

export async function createBoard(input: z.infer<typeof createBoardInput>): Promise<Board> {
  if (await slugTaken(input.slug)) throw new Error("Another board uses that slug");
  const [board] = await db
    .insert(boards)
    .values({ id: crypto.randomUUID(), ...input })
    .returning(shown);
  return board!;
}

export async function updateBoard({ id, ...input }: z.infer<typeof updateBoardInput>) {
  if (await slugTaken(input.slug, id)) throw new Error("Another board uses that slug");
  const [board] = await db.update(boards).set(input).where(eq(boards.id, id)).returning(shown);
  return board ?? null;
}

/** Deletes the board with its requests. */
export async function deleteBoard(id: string) {
  const [board] = await db.delete(boards).where(eq(boards.id, id)).returning(shown);
  return board ?? null;
}
