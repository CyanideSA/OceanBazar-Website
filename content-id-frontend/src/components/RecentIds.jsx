import { useState } from "react";
import { Check, Copy } from "lucide-react";

function CopyButton({ value, label = "Copy" }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ob-btn ob-btn-secondary px-3 py-2"
      title={label}
    >
      {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
      {copied ? "Copied" : label}
    </button>
  );
}

export default function RecentIds({ drafts, loading }) {
  if (loading) {
    return (
      <div className="ob-card p-6">
        <p className="text-sm text-muted-foreground">Loading your recent IDs…</p>
      </div>
    );
  }

  if (!drafts?.length) {
    return (
      <div className="ob-card p-6">
        <h2 className="text-lg font-bold text-foreground">Your recent IDs</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Generated product IDs will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="ob-card overflow-hidden">
      <div className="border-b border-border/60 px-6 py-4">
        <h2 className="text-lg font-bold text-foreground">Your recent IDs</h2>
        <p className="text-sm text-muted-foreground">Last {drafts.length} reserved product IDs</p>
      </div>
      <ul className="divide-y divide-border/60">
        {drafts.map((draft) => (
          <li key={draft.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-base font-bold text-primary">{draft.displayId}</p>
              <p className="truncate text-sm font-medium text-foreground">{draft.productName}</p>
              <p className="text-xs text-muted-foreground">
                {draft.categoryName} / {draft.subcategoryName} · {draft.brandName}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(draft.createdAt).toLocaleString()}
              </p>
            </div>
            <CopyButton value={draft.displayId} label="Copy ID" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export { CopyButton };
