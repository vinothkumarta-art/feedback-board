import { Link } from "@tanstack/react-router";
import { Markdown } from "@/client/components/Markdown";
import { StatusBadge } from "@/client/components/StatusBadge";
import { Badge } from "@/client/components/ui/badge";
import { formatDate } from "@/client/lib/format";

export interface Update {
  id: string;
  title: string;
  body: string;
  tag: string;
  publishedAt: string;
  links: { id: string; title: string; status: string; votes: number }[];
}

/** A published entry's tag, date, body and the requests it answers. */
export function UpdateBody({ entry }: { entry: Update }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary">{entry.tag}</Badge>
        <time dateTime={entry.publishedAt}>{formatDate(entry.publishedAt)}</time>
      </div>
      <Markdown source={entry.body} />
      {entry.links.length > 0 ? (
        <ul className="space-y-1 rounded-lg border border-border p-3 text-sm">
          {entry.links.map((link) => (
            <li key={link.id} data-testid="linked-request" className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-muted-foreground">
                {link.votes} {link.votes === 1 ? "vote" : "votes"}
              </span>
              <Link to="/p/r/$id" params={{ id: link.id }} className="min-w-0 flex-1 truncate hover:underline">
                {link.title}
              </Link>
              <StatusBadge status={link.status} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
