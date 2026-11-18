import type { ReactNode } from "react";

/**
 * Renders the Markdown a changelog entry is written in: headings, lists,
 * code blocks, quotes, paragraphs, bold, italic, inline code and links.
 * Builds React elements, never HTML, so nothing in the text runs.
 */
export function Markdown({ source }: { source: string }) {
  return <div className="space-y-3 text-sm leading-relaxed">{blocks(source)}</div>;
}

function blocks(source: string): ReactNode[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const key = out.length;
    if (line.trim() === "") {
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith("```")) code.push(lines[i++]!);
      i++;
      out.push(
        <pre key={key} className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">
          {code.join("\n")}
        </pre>,
      );
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      const text = inline(heading[2]!);
      out.push(
        level === 1 ? (
          <h2 key={key} className="text-xl font-semibold">{text}</h2>
        ) : level === 2 ? (
          <h3 key={key} className="text-lg font-semibold">{text}</h3>
        ) : (
          <h4 key={key} className="font-semibold">{text}</h4>
        ),
      );
      i++;
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]!)) {
        items.push(lines[i++]!.replace(/^\s*([-*]|\d+\.)\s+/, ""));
      }
      const children = items.map((item, n) => <li key={n}>{inline(item)}</li>);
      out.push(
        ordered ? (
          <ol key={key} className="list-decimal space-y-1 pl-5">{children}</ol>
        ) : (
          <ul key={key} className="list-disc space-y-1 pl-5">{children}</ul>
        ),
      );
      continue;
    }
    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i]!.startsWith(">")) quote.push(lines[i++]!.replace(/^>\s?/, ""));
      out.push(
        <blockquote key={key} className="border-l-2 border-border pl-3 text-muted-foreground">
          {inline(quote.join(" "))}
        </blockquote>,
      );
      continue;
    }
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== "" &&
      !/^(#{1,3}\s|```|>|\s*([-*]|\d+\.)\s+)/.test(lines[i]!)
    ) {
      paragraph.push(lines[i++]!);
    }
    out.push(<p key={key}>{inline(paragraph.join(" "))}</p>);
  }
  return out;
}

const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)\s]+\))/;

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, n) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1)
      return <code key={n} className="rounded bg-muted px-1 font-mono text-xs">{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 3)
      return <strong key={n}>{part.slice(2, -2)}</strong>;
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_")))
      if (part.length > 2) return <em key={n}>{part.slice(1, -1)}</em>;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const href = link[2]!;
      if (/^https?:\/\//i.test(href) || href.startsWith("/"))
        return (
          <a key={n} href={href} rel="noopener noreferrer" className="text-primary underline underline-offset-2">
            {link[1]}
          </a>
        );
      return link[1];
    }
    return part;
  });
}
