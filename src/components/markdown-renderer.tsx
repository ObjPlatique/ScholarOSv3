"use client";

import katex from "katex";
import type { ReactNode } from "react";

type Token = { kind: "text" | "strong" | "em" | "code" | "math" | "displayMath"; value: string };

function Math({ value, display = false }: { value: string; display?: boolean }) {
  try {
    const html = katex.renderToString(value.trim(), {
      displayMode: display,
      throwOnError: false,
      strict: "ignore",
      trust: false,
    });
    return <span className={display ? "my-3 block overflow-x-auto py-1 text-center" : "mx-0.5 inline-block align-middle"} dangerouslySetInnerHTML={{ __html: html }} />;
  } catch {
    return <code className="rounded bg-black/5 px-1 dark:bg-white/10">{display ? `$$${value}$$` : `$${value}$`}</code>;
  }
}

function renderInline(text: string): ReactNode[] {
  const normalized = text
    .replace(/\$\\rightarrow\$/g, "→")
    .replace(/\$\\to\$/g, "→")
    .replace(/\$\\Rightarrow\$/g, "⇒")
    .replace(/\$\\leq\$/g, "≤")
    .replace(/\$\\geq\$/g, "≥")
    .replace(/\$\\times\$/g, "×")
    .replace(/\$\\cdot\$/g, "·");

  const regex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  const parts = normalized.split(regex).filter(Boolean);
  const tokens: Token[] = parts.map((part) => {
    if (part.startsWith("$$") && part.endsWith("$$")) return { kind: "displayMath", value: part.slice(2, -2) };
    if (part.startsWith("$") && part.endsWith("$")) return { kind: "math", value: part.slice(1, -1) };
    if (part.startsWith("**") && part.endsWith("**")) return { kind: "strong", value: part.slice(2, -2) };
    if (part.startsWith("`") && part.endsWith("`")) return { kind: "code", value: part.slice(1, -1) };
    if (part.startsWith("*") && part.endsWith("*")) return { kind: "em", value: part.slice(1, -1) };
    return { kind: "text", value: part };
  });

  return tokens.map((token, index) => {
    if (token.kind === "strong") return <strong key={index}>{token.value}</strong>;
    if (token.kind === "em") return <em key={index}>{token.value}</em>;
    if (token.kind === "code") return <code key={index} className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/10">{token.value}</code>;
    if (token.kind === "math") return <Math key={index} value={token.value} />;
    if (token.kind === "displayMath") return <Math key={index} value={token.value} display />;
    return <span key={index}>{token.value}</span>;
  });
}

export default function MarkdownRenderer({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let ordered: string[] = [];
  let code: string[] = [];
  let math: string[] = [];
  let inCode = false;
  let inMath = false;

  const flush = () => {
    if (list.length) { blocks.push(<ul key={`ul-${blocks.length}`} className="my-2 list-disc space-y-1.5 pl-5">{list.map((item, i) => <li key={i}>{renderInline(item)}</li>)}</ul>); list = []; }
    if (ordered.length) { blocks.push(<ol key={`ol-${blocks.length}`} className="my-2 list-decimal space-y-1.5 pl-5">{ordered.map((item, i) => <li key={i}>{renderInline(item)}</li>)}</ol>); ordered = []; }
    if (code.length) { blocks.push(<pre key={`code-${blocks.length}`} className="my-3 overflow-x-auto rounded-xl bg-gray-900 p-3 text-xs leading-6 text-gray-100"><code>{code.join("\n")}</code></pre>); code = []; }
    if (math.length) { blocks.push(<Math key={`math-${blocks.length}`} value={math.join("\n")} display />); math = []; }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("```") && !inMath) { if (inCode) { inCode = false; flush(); } else { flush(); inCode = true; } return; }
    if (inCode) { code.push(line); return; }
    if (trimmed === "$$") { if (inMath) { inMath = false; flush(); } else { flush(); inMath = true; } return; }
    if (inMath) { math.push(line); return; }
    if (!trimmed) { flush(); return; }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) { if (ordered.length) flush(); list.push(bullet[1]); return; }
    const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (numbered) { if (list.length) flush(); ordered.push(numbered[1]); return; }

    flush();
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const Tag = level === 1 ? "h2" : level === 2 ? "h3" : "h4";
      blocks.push(<Tag key={`h-${index}`} className={`${level === 1 ? "mt-4 text-lg" : level === 2 ? "mt-3 text-base" : "mt-2 text-sm"} font-bold leading-7 text-gray-950 dark:text-white`}>{renderInline(heading[2])}</Tag>);
      return;
    }
    if (trimmed.startsWith("> ")) { blocks.push(<blockquote key={`q-${index}`} className="my-2 border-l-4 border-indigo-400 pl-3 italic text-gray-600 dark:text-gray-300">{renderInline(trimmed.slice(2))}</blockquote>); return; }
    blocks.push(<p key={`p-${index}`} className="my-1.5 leading-7">{renderInline(trimmed)}</p>);
  });

  flush();
  return <div className="break-words">{blocks}</div>;
}
