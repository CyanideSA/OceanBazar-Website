import type { StructuredMessage, MessageType } from './types';
import { msgId } from './types';

const GREETINGS = [
  'Hi{name}! Welcome to OceanBazar — how can I help you today?',
  'Hello{name}! Great to see you. What can I assist you with?',
  'Hey{name}! I am here to help with orders, products, returns, and more.',
];

const ACK = [
  'Got it{name}! Let me help with that.',
  'Sure thing{name}! One moment.',
  'Absolutely{name}! Working on that for you.',
];

const FALLBACK = [
  'I want to make sure I help you correctly. Could you tell me a bit more?',
  'I did not quite catch that. Try one of the quick options below.',
  'Let me guide you — pick an option or describe what you need.',
];

export function firstName(fullName?: string | null): string {
  if (!fullName?.trim()) return '';
  return fullName.trim().split(/\s+/)[0];
}

export function personalize(template: string, name?: string | null): string {
  const n = firstName(name);
  return template.replace(/\{name\}/g, n ? `, ${n}` : '');
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function greeting(name?: string | null): string {
  return personalize(pick(GREETINGS), name);
}

export function acknowledge(name?: string | null): string {
  return personalize(pick(ACK), name);
}

export function fallback(name?: string | null): string {
  return personalize(pick(FALLBACK), name);
}

export function buildTextMessage(
  message: string,
  opts?: { quickReplies?: string[]; typingMs?: number },
): StructuredMessage {
  return {
    id: msgId(),
    sender: 'bot',
    message,
    message_type: 'text',
    timestamp: new Date().toISOString(),
    status: 'sent',
    quickReplies: opts?.quickReplies,
    typingMs: opts?.typingMs ?? 600 + Math.floor(Math.random() * 400),
  };
}

export function buildTypedMessage(
  message: string,
  messageType: MessageType,
  content: StructuredMessage['content'],
  opts?: { quickReplies?: string[]; typingMs?: number },
): StructuredMessage {
  return {
    id: msgId(),
    sender: 'bot',
    message,
    message_type: messageType,
    content,
    timestamp: new Date().toISOString(),
    status: 'sent',
    quickReplies: opts?.quickReplies,
    typingMs: opts?.typingMs ?? 800 + Math.floor(Math.random() * 600),
  };
}
