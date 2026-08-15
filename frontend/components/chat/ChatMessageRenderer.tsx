'use client';

import { Bot, MessageCircle, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QuickReplyChips } from './design-system/QuickReplyChips';
import { ProductCardChat, type ProductCardData } from './design-system/ProductCardChat';
import { OrderTimeline, type OrderTimelineData } from './design-system/OrderTimeline';

export interface ChatMessage {
  id: string;
  message: string;
  sender: 'user' | 'bot' | 'agent' | 'system';
  senderName?: string;
  timestamp: string;
  status?: string;
  readAt?: string | null;
  attachments?: string[];
  quickReplies?: string[];
  message_type?: string;
  content?: unknown;
}

interface Props {
  msg: ChatMessage;
  userInitial?: string;
  onQuickReply: (text: string) => void;
  onAction: (action: string, payload: Record<string, unknown>) => void;
}

export function ChatMessageRenderer({ msg, userInitial = 'U', onQuickReply, onAction }: Props) {
  const isUser = msg.sender === 'user';
  const isBot = msg.sender === 'bot';
  const isSystem = msg.sender === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <span className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">{msg.message}</span>
      </div>
    );
  }

  const products = msg.message_type === 'product_card' && Array.isArray(msg.content)
    ? (msg.content as ProductCardData[])
    : null;
  const order = msg.message_type === 'order_card' && msg.content && typeof msg.content === 'object'
    ? (msg.content as OrderTimelineData)
    : null;
  const systemAction = msg.message_type === 'system_action' && msg.content && typeof msg.content === 'object'
    ? (msg.content as { action: string; label: string; url?: string; payload?: Record<string, unknown> })
    : null;

  return (
    <div className={cn('flex items-end gap-2', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
          {isBot ? <Bot className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
        </span>
      )}
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm',
          isUser ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted text-foreground',
        )}
      >
        {!isUser && (
          <p className="mb-0.5 text-[10px] font-semibold text-muted-foreground">
            {isBot ? 'OceanBazar Assistant' : msg.senderName}
          </p>
        )}
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {msg.attachments.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-[11px] underline">
                <Paperclip className="inline h-3 w-3" /> Attachment
              </a>
            ))}
          </div>
        )}
        <p className="whitespace-pre-wrap break-words leading-snug">{msg.message}</p>
        {products && <ProductCardChat products={products} onAction={onAction} />}
        {order && <OrderTimeline order={order} />}
        {systemAction && (
          <button
            type="button"
            onClick={() => {
              if (systemAction.url) window.location.href = systemAction.url;
              else onAction(systemAction.action, systemAction.payload || {});
            }}
            className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground"
          >
            {systemAction.label}
          </button>
        )}
        {!isUser && msg.quickReplies && (
          <QuickReplyChips replies={msg.quickReplies} onSelect={onQuickReply} />
        )}
        <div className={cn('mt-1 text-[10px]', isUser ? 'text-primary-foreground/60 text-right' : 'text-muted-foreground')}>
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      {isUser && (
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
          {userInitial}
        </span>
      )}
    </div>
  );
}
