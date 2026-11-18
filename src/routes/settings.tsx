import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { MemberShell } from "@/client/components/MemberShell";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Switch } from "@/client/components/ui/switch";
import { errorMessage } from "@/client/lib/format";
import {
  createBoard,
  deleteBoard,
  getSettings,
  updateBoard,
  updateRoadmapPublic,
} from "@/serverFunctions/boards";

export const Route = createFileRoute("/settings")({
  loader: () => getSettings(),
  head: () => ({ meta: [{ title: "Settings · Feedback Board" }] }),
  component: SettingsPage,
});

type Board = Awaited<ReturnType<typeof getSettings>>["boards"][number];

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function SettingsPage() {
  const { boards, roadmapPublic, admin } = Route.useLoaderData();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<Board | null>(null);
  const [deleting, setDeleting] = useState<Board | null>(null);
  const [pending, setPending] = useState(false);

  async function run(work: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await work();
      await router.invalidate();
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setPending(false);
    }
  }

  return (
    <MemberShell>
      <PageHeader title="Settings" />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Boards</h2>
        {boards.length === 0 ? (
          <EmptyState title="No boards yet" description={admin ? "Add one below." : "An admin adds boards here."} />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {boards.map((board) => (
              <li key={board.id} data-testid="board-row" className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{board.name}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    /p/b/{board.slug}
                    {board.description ? ` · ${board.description}` : ""}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  nativeButton={false}
                  render={<a href={`/p/b/${board.slug}`} target="_blank" rel="noreferrer" />}
                >
                  <ExternalLink aria-hidden />
                  Open
                </Button>
                {admin ? (
                  <>
                    <Button size="sm" variant="outline" data-testid="board-rename" onClick={() => setRenaming(board)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" data-testid="board-delete" onClick={() => setDeleting(board)}>
                      Delete
                    </Button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {admin ? <NewBoard run={run} pending={pending} /> : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Public pages</h2>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
          <Label htmlFor="roadmap-public" className="flex-col items-start gap-1">
            <span>Public roadmap</span>
            <a href="/p/roadmap" className="text-sm font-normal text-muted-foreground underline">
              /p/roadmap
            </a>
          </Label>
          <Switch
            id="roadmap-public"
            data-testid="roadmap-public-switch"
            checked={roadmapPublic}
            disabled={!admin || pending}
            onCheckedChange={(value) => run(() => updateRoadmapPublic({ data: { value } }))}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Changelog: <a href="/p/updates" className="underline">/p/updates</a> · Boards: <a href="/p" className="underline">/p</a>
        </p>
      </section>

      {renaming ? <EditBoard board={renaming} onClose={() => setRenaming(null)} /> : null}
      {deleting ? (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          confirmLabel="Delete board"
          destructive
          pending={pending}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await run(() => deleteBoard({ data: { id: deleting.id } }));
            setDeleting(null);
          }}
        >
          Its requests, votes and comments are deleted too.
        </ConfirmDialog>
      ) : null}
    </MemberShell>
  );
}

function NewBoard({ run, pending }: { run: (work: () => Promise<unknown>) => Promise<boolean>; pending: boolean }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  return (
    <form
      className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (await run(() => createBoard({ data: { name, slug, description } }))) {
          setName("");
          setSlug("");
          setSlugEdited(false);
          setDescription("");
        }
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="board-name">Name</Label>
        <Input
          id="board-name"
          data-testid="board-name"
          value={name}
          required
          onChange={(e) => {
            setName(e.target.value);
            if (!slugEdited) setSlug(slugify(e.target.value));
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="board-slug">Link</Label>
        <Input
          id="board-slug"
          data-testid="board-slug"
          value={slug}
          required
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugEdited(true);
          }}
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="board-description">Description</Label>
        <Input id="board-description" data-testid="board-description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" data-testid="board-create" pending={pending}>
          Add board
        </Button>
      </div>
    </form>
  );
}

function EditBoard({ board, onClose }: { board: Board; onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: board.name, slug: board.slug, description: board.description });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit board</DialogTitle>
        </DialogHeader>
        <form
          id="edit-board"
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError(null);
            try {
              await updateBoard({ data: { id: board.id, ...form } });
              await router.invalidate();
              onClose();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="rename-name">Name</Label>
            <Input id="rename-name" data-testid="rename-name" value={form.name} required onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rename-slug">Link</Label>
            <Input id="rename-slug" value={form.slug} required onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rename-description">Description</Label>
            <Input id="rename-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="edit-board" data-testid="rename-save" pending={pending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
