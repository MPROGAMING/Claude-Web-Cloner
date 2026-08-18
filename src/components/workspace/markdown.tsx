"use client";

import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Assistant message rendering.
 *
 * Code blocks get a lightweight Luau highlighter rather than a full Shiki
 * bundle: messages contain short illustrative snippets (whole files live in the
 * file viewer), and shipping a 1MB grammar to render five lines is not a good
 * trade. The file viewer uses real Shiki, where it matters.
 */

const LUAU_KEYWORDS =
  /\b(local|function|end|if|then|else|elseif|for|while|do|return|break|continue|and|or|not|nil|true|false|in|repeat|until|type|export)\b/g;
const LUAU_GLOBALS =
  /\b(game|workspace|script|task|math|table|string|os|tostring|tonumber|pairs|ipairs|require|print|warn|assert|pcall|error|typeof|Instance|Vector3|CFrame|Color3|UDim2|Enum|self)\b/g;

function highlightLuau(code: string): string {
  const escaped = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Order matters: comments and strings first so their contents aren't
  // re-tokenised as keywords.
  return escaped
    .replace(/(--\[\[[\s\S]*?\]\]|--[^\n]*)/g, '<span class="text-muted-foreground/60">$1</span>')
    .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, '<span class="text-[var(--success)]">$1</span>')
    .replace(LUAU_KEYWORDS, '<span class="text-[var(--ember)]">$1</span>')
    .replace(LUAU_GLOBALS, '<span class="text-[var(--signal)]">$1</span>')
    .replace(/\b(\d+\.?\d*)\b/g, '<span class="text-[var(--warning)]">$1</span>');
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const isLuau = !language || /^lua/i.test(language);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="group/code relative my-3 overflow-hidden rounded-lg border border-border bg-surface-sunken">
      <div className="flex items-center justify-between border-b border-hairline px-3 py-1.5">
        <span className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
          {language || "luau"}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy code"
          className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/code:opacity-100 focus-ember"
        >
          {copied ? (
            <Check className="size-3.5 text-[var(--success)]" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[0.75rem] leading-[1.65]">
        {isLuau ? (
          <code dangerouslySetInnerHTML={{ __html: highlightLuau(code) }} />
        ) : (
          <code>{code}</code>
        )}
      </pre>
    </div>
  );
}

export const Markdown = memo(function Markdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-[0.875rem] leading-[1.65] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-2.5">{children}</p>,
          h1: ({ children }) => <h1 className="mb-2 mt-5 text-base font-semibold">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 mt-5 text-[0.9375rem] font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1.5 mt-4 text-sm font-semibold">{children}</h3>,
          ul: ({ children }) => <ul className="my-2.5 space-y-1 pl-5 [&>li]:list-disc">{children}</ul>,
          ol: ({ children }) => <ol className="my-2.5 space-y-1 pl-5 [&>li]:list-decimal">{children}</ol>,
          li: ({ children }) => <li className="pl-0.5 marker:text-muted-foreground">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--ember)] underline underline-offset-2"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-border pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-4 border-hairline" />,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-[0.8125rem]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-border bg-surface-sunken px-3 py-2 text-left font-medium">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border-b border-hairline px-3 py-2">{children}</td>,
          code: ({ className: codeClass, children }) => {
            const match = /language-(\w+)/.exec(codeClass ?? "");
            const text = String(children).replace(/\n$/, "");

            // Inline code has no language class and no newline.
            if (!match && !text.includes("\n")) {
              return (
                <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[0.8125em]">
                  {children}
                </code>
              );
            }
            return <CodeBlock code={text} language={match?.[1]} />;
          },
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
