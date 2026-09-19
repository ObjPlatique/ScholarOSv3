"use client";

import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

export default function MarkdownRenderer({ text, inline = false }: { text: string; inline?: boolean }) {
  const normalized = text.replace(/\r\n?/g, "\n").trim();

  return (
    <div className={`markdown-content min-w-0 break-words ${inline ? "inline leading-6" : "leading-7"}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ children }) => <h2 className="mt-4 mb-2 text-lg font-bold leading-7 text-gray-950 dark:text-white">{children}</h2>,
          h2: ({ children }) => <h3 className="mt-4 mb-2 text-base font-bold leading-7 text-gray-950 dark:text-white">{children}</h3>,
          h3: ({ children }) => <h4 className="mt-3 mb-1.5 text-sm font-bold leading-6 text-gray-950 dark:text-white">{children}</h4>,
          p: ({ children }) => inline ? <span className="leading-6">{children}</span> : <p className="my-2 leading-7">{children}</p>,
          ul: ({ children }) => inline ? <span className="inline">{children}</span> : <ul className="my-2 list-disc space-y-1.5 pl-6">{children}</ul>,
          ol: ({ children }) => inline ? <span className="inline">{children}</span> : <ol className="my-2 list-decimal space-y-1.5 pl-6">{children}</ol>,
          li: ({ children }) => inline ? <span className="mr-1">{children}</span> : <li className="pl-1 leading-7">{children}</li>,
          blockquote: ({ children }) => <blockquote className="my-3 border-l-4 border-indigo-400 pl-4 italic text-gray-600 dark:text-gray-300">{children}</blockquote>,
          strong: ({ children }) => <strong className="font-bold text-gray-950 dark:text-white">{children}</strong>,
          em: ({ children }) => <em>{children}</em>,
          code: ({ className, children, ...props }) => {
            const isBlock = Boolean(className?.includes("language-"));
            if (isBlock) {
              return <code className="font-mono text-xs leading-6" {...props}>{children}</code>;
            }
            return <code className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/10" {...props}>{children}</code>;
          },
          pre: ({ children }) => <pre className="my-3 overflow-x-auto rounded-xl bg-gray-900 p-3 text-xs leading-6 text-gray-100">{children}</pre>,
          a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200">{children}</a>,
          table: ({ children }) => <div className="my-3 overflow-x-auto"><table className="min-w-full border-collapse text-sm">{children}</table></div>,
          th: ({ children }) => <th className="border border-gray-300 bg-gray-50 px-3 py-2 text-left font-semibold dark:border-gray-600 dark:bg-white/10">{children}</th>,
          td: ({ children }) => <td className="border border-gray-300 px-3 py-2 align-top dark:border-gray-600">{children}</td>,
          hr: () => <hr className="my-4 border-gray-200 dark:border-gray-600" />,
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
