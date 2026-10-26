import * as React from "react";
import Link from "next/link";

/**
 * Renders a post written in Admin -> Blog. The body is plain text (never HTML): blank lines separate paragraphs,
 * "## " / "### " start a heading, lines starting "- " make a bullet list, "1. " a numbered list,
 * **bold** and [link text](https://… or /path) work inside text.
 */
export function PostBody({ content }: { content: string }) {
  const blocks = content.replace(/\r\n?/g, "\n").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="space-y-5 text-[17px] leading-relaxed text-foreground/90">
      {blocks.map((block, i) => {
        const lines = block.split("\n").map((l) => l.trim());
        const heading = /^(#{2,3})\s+(.+)$/.exec(block);
        if (heading && lines.length === 1) {
          return heading[1] === "##" ? (
            <h2 key={i} className="pt-4 font-display text-2xl font-bold text-foreground">{inline(heading[2])}</h2>
          ) : (
            <h3 key={i} className="pt-2 font-display text-xl font-bold text-foreground">{inline(heading[2])}</h3>
          );
        }
        if (lines.every((l) => /^[-*]\s+/.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-2 pl-6 marker:text-accent">
              {lines.map((l, j) => <li key={j}>{inline(l.replace(/^[-*]\s+/, ""))}</li>)}
            </ul>
          );
        }
        if (lines.every((l) => /^\d+[.)]\s+/.test(l))) {
          return (
            <ol key={i} className="list-decimal space-y-2 pl-6 marker:font-bold marker:text-accent">
              {lines.map((l, j) => <li key={j}>{inline(l.replace(/^\d+[.)]\s+/, ""))}</li>)}
            </ol>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <React.Fragment key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

const linkClass = "font-semibold text-accent underline underline-offset-2 hover:text-primary-hover";

/** **bold** and [text](url). Only https:// and on-site /paths become links; anything else stays as text. */
function inline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(((?:https:\/\/|\/)[^\s)]+)\)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      out.push(<strong key={m.index} className="font-bold text-foreground">{m[1]}</strong>);
    } else if (m[3].startsWith("/")) {
      out.push(<Link key={m.index} href={m[3]} className={linkClass}>{m[2]}</Link>);
    } else {
      out.push(<a key={m.index} href={m[3]} target="_blank" rel="noopener noreferrer" className={linkClass}>{m[2]}</a>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
