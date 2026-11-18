import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { Markdown } from "@/client/components/Markdown";
import { MemberShell } from "@/client/components/MemberShell";
import { PageHeader } from "@/client/components/PageHeader";
import { SimpleSelect } from "@/client/components/SimpleSelect";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { errorMessage, formatDateTime } from "@/client/lib/format";
import { CHANGELOG_TAGS } from "@/server/shared";
import { deleteEntry, getEntryEditor, saveEntry } from "@/serverFunctions/changelog";

type Data = Awaited<ReturnType<typeof getEntryEditor>>;
type Action = "draft" | "publish" | "schedule" | "keep";

const CUSTOM = "__custom";
const STATE_LABEL = { draft: "Draft", scheduled: "Scheduled", published: "Published" } as const;

/** The value a datetime-local input shows for an ISO time, in the browser's zone. */
function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function EntryEditor({ data }: { data: Data }) {
  const { entry, requests, admin } = data;
  const router = useRouter();
  const navigate = useNavigate();
  const initialTag = entry?.tag ?? CHANGELOG_TAGS[0]!;
  const [title, setTitle] = useState(entry?.title ?? "");
  const [body, setBody] = useState(entry?.body ?? "");
  const [tagChoice, setTagChoice] = useState(CHANGELOG_TAGS.includes(initialTag) ? initialTag : CUSTOM);
  const [customTag, setCustomTag] = useState(CHANGELOG_TAGS.includes(initialTag) ? "" : initialTag);
  const [linked, setLinked] = useState<string[]>(entry?.links.map((l) => l.id) ?? []);
  const [at, setAt] = useState(entry?.state === "scheduled" ? toLocalInput(entry.publishAt) : "");
  const [filter, setFilter] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState(false);

  async function save(action: Action) {
    setPending(true);
    setError(null);
    try {
      const result = await saveEntry({
        data: {
          id: entry?.id,
          title,
          body,
          tag: tagChoice === CUSTOM ? customTag : tagChoice,
          requestIds: linked,
          action,
          at: action === "schedule" && at ? new Date(at).toISOString() : undefined,
        },
      });
      if (entry) await router.invalidate();
      else await navigate({ to: "/changelog/$id", params: { id: result.id } });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  const shown = requests.filter((r) => r.title.toLowerCase().includes(filter.toLowerCase()));

  return (
    <MemberShell>
      <PageHeader
        backLink={
          <Link to="/changelog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" aria-hidden />
            Changelog
          </Link>
        }
        title={entry ? "Edit entry" : "New entry"}
        description={
          entry ? (
            <span className="flex items-center gap-2">
              <Badge data-testid="entry-state" variant={entry.state === "published" ? "default" : "secondary"}>
                {STATE_LABEL[entry.state]}
              </Badge>
              {entry.publishAt ? formatDateTime(entry.publishAt) : null}
            </span>
          ) : null
        }
        actions={
          entry && admin ? (
            <Button variant="outline" data-testid="delete-entry" onClick={() => setDeleting(true)}>
              Delete
            </Button>
          ) : null
        }
      />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="entry-title">Title</Label>
          <Input id="entry-title" data-testid="entry-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label>Tag</Label>
            <SimpleSelect
              label="Tag"
              testId="entry-tag"
              value={tagChoice}
              items={[...CHANGELOG_TAGS.map((t) => ({ value: t, label: t })), { value: CUSTOM, label: "Custom" }]}
              onChange={setTagChoice}
            />
          </div>
          {tagChoice === CUSTOM ? (
            <Input
              aria-label="Custom tag"
              placeholder="Tag name"
              data-testid="entry-custom-tag"
              className="w-48"
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
            />
          ) : null}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="entry-body">Body (Markdown)</Label>
            <Button size="sm" variant="ghost" onClick={() => setPreview(!preview)}>
              {preview ? "Edit" : "Preview"}
            </Button>
          </div>
          {preview ? (
            <div className="rounded-lg border border-border p-3">
              <Markdown source={body} />
            </div>
          ) : (
            <Textarea
              id="entry-body"
              data-testid="entry-body"
              className="min-h-48 font-mono"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          )}
        </div>
        <div className="space-y-2">
          <Label>Linked requests</Label>
          {requests.length > 6 ? (
            <Input aria-label="Filter requests" placeholder="Filter" value={filter} onChange={(e) => setFilter(e.target.value)} />
          ) : null}
          <div data-testid="linked-requests" className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
            {requests.length === 0 ? <p className="text-sm text-muted-foreground">No requests yet.</p> : null}
            {shown.map((request) => (
              <div key={request.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  aria-label={request.title}
                  checked={linked.includes(request.id)}
                  onCheckedChange={(checked) =>
                    setLinked((prev) => (checked ? [...prev, request.id] : prev.filter((id) => id !== request.id)))
                  }
                />
                <span>{request.title}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {entry && entry.state !== "draft" ? (
            <>
              <Button onClick={() => save("keep")} pending={pending}>
                Save
              </Button>
              <Button variant="outline" data-testid="unpublish" onClick={() => save("draft")} disabled={pending}>
                Unpublish
              </Button>
            </>
          ) : (
            <Button variant="outline" data-testid="save-draft" onClick={() => save("draft")} pending={pending}>
              Save draft
            </Button>
          )}
          {entry?.state !== "published" ? (
            <Button data-testid="publish-now" onClick={() => save("publish")} disabled={pending}>
              Publish now
            </Button>
          ) : null}
          <span className="ml-auto flex items-center gap-2">
            <Input
              type="datetime-local"
              aria-label="Publish at"
              data-testid="schedule-at"
              className="w-56"
              value={at}
              onChange={(e) => setAt(e.target.value)}
            />
            <Button variant="outline" data-testid="schedule" onClick={() => save("schedule")} disabled={pending || !at}>
              Schedule
            </Button>
          </span>
        </div>
      </div>
      {deleting && entry ? (
        <ConfirmDialog
          title="Delete this entry?"
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            setPending(true);
            try {
              await deleteEntry({ data: { id: entry.id } });
              await navigate({ to: "/changelog" });
            } catch (err) {
              setError(errorMessage(err));
              setDeleting(false);
            } finally {
              setPending(false);
            }
          }}
        />
      ) : null}
    </MemberShell>
  );
}
