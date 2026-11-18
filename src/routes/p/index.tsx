import { Link, createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/client/components/EmptyState";
import { PublicShell } from "@/client/components/MemberShell";
import { PageHeader } from "@/client/components/PageHeader";
import { PublicError, PublicNotFound } from "@/client/components/PublicParts";
import { getPublic } from "@/client/lib/publicApi";

interface Boards {
  boards: { name: string; slug: string; description: string }[];
}

// Public, and drawn in the browser from /p/api: visitors can't call server functions.
export const Route = createFileRoute("/p/")({
  ssr: false,
  loader: () => getPublic<Boards>("/p/api/boards"),
  head: () => ({ meta: [{ title: "Feedback" }] }),
  component: BoardsPage,
  notFoundComponent: PublicNotFound,
  errorComponent: PublicError,
});

function BoardsPage() {
  const { boards } = Route.useLoaderData();
  return (
    <PublicShell>
      <PageHeader title="Feedback" />
      {boards.length === 0 ? (
        <EmptyState title="No boards yet" />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {boards.map((board) => (
            <li key={board.slug} className="px-4 py-3">
              <Link to="/p/b/$slug" params={{ slug: board.slug }} className="font-medium hover:underline">
                {board.name}
              </Link>
              {board.description ? <p className="text-sm text-muted-foreground">{board.description}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </PublicShell>
  );
}
