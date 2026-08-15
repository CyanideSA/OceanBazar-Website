'use client';

interface Props {
  replies: string[];
  onSelect: (reply: string) => void;
}

export function QuickReplyChips({ replies, onSelect }: Props) {
  if (!replies.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {replies.map((qr) => (
        <button
          key={qr}
          type="button"
          onClick={() => onSelect(qr)}
          className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
        >
          {qr}
        </button>
      ))}
    </div>
  );
}
