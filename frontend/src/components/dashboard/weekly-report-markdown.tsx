import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";

const markdownContentClassName =
  "space-y-3 text-sm leading-7 text-slate-700 [&_a]:text-blue-600 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_code]:rounded [&_code]:bg-slate-200 [&_code]:px-1 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:text-base [&_h4]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:text-slate-700 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-slate-900 [&_pre]:p-3 [&_pre]:text-slate-100";

export function WeeklyReportMarkdown({
  value,
  emptyMessage,
  compact = false,
}: {
  value: string;
  emptyMessage: string;
  compact?: boolean;
}) {
  if (!value.trim()) {
    return <div className="text-sm text-slate-500">{emptyMessage}</div>;
  }

  return (
    <div className={compact ? `${markdownContentClassName} max-h-56 overflow-hidden` : markdownContentClassName}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
    </div>
  );
}

const TOOLBAR_ACTIONS = [
  { key: "h3", label: "H3" },
  { key: "h4", label: "H4" },
  { key: "ordered", label: "1." },
  { key: "bullet", label: "•" },
] as const;

type ToolbarAction = (typeof TOOLBAR_ACTIONS)[number]["key"];

export function applyMarkdownBlockAction({
  value,
  selectionStart,
  selectionEnd,
  action,
}: {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  action: ToolbarAction;
}) {
  const prefixMap = {
    h3: "### ",
    h4: "#### ",
    bullet: "- ",
  } as const;

  if (selectionStart === selectionEnd) {
    const prefix = action === "ordered" ? "1. " : prefixMap[action];
    const nextValue = `${value.slice(0, selectionStart)}${prefix}${value.slice(selectionEnd)}`;
    const nextCursor = selectionStart + prefix.length;
    return { nextValue, nextSelectionStart: nextCursor, nextSelectionEnd: nextCursor };
  }

  const selectedText = value.slice(selectionStart, selectionEnd);
  const lines = selectedText.split("\n");
  const updatedLines = lines.map((line, index) => {
    if (action === "ordered") {
      const clean = line.replace(/^\s*\d+\.\s*/, "");
      return `${index + 1}. ${clean}`;
    }

    const prefix = prefixMap[action];
    const clean = line.replace(/^\s*(#{3,4}\s+|-\s+)/, "");
    return `${prefix}${clean}`;
  });
  const replacement = updatedLines.join("\n");
  const nextValue = `${value.slice(0, selectionStart)}${replacement}${value.slice(selectionEnd)}`;
  return {
    nextValue,
    nextSelectionStart: selectionStart,
    nextSelectionEnd: selectionStart + replacement.length,
  };
}

export function WeeklyReportEditorToolbar({
  onAction,
}: {
  onAction: (action: ToolbarAction) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
      {TOOLBAR_ACTIONS.map((item) => (
        <Button
          key={item.key}
          type="button"
          variant="outline"
          size="sm"
          className="h-8 min-w-10 px-2 text-xs font-semibold"
          onClick={() => onAction(item.key)}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}
