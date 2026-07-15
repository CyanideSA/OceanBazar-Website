/**
 * Rule-based e-commerce chatbot for OceanBazar.
 * Delegates to the unified chat engine (no external AI).
 */
export type { StructuredMessage as BotMessage } from './chat/types';
export { getWelcomeMessages, processMessage, processAction } from './chat/chatEngine';

/** @deprecated Use chatEngine.processMessage — kept for backward compatibility */
export interface BotResult {
  reply: import('./chat/types').StructuredMessage;
  shouldEscalate: boolean;
  escalateReason?: string;
}
