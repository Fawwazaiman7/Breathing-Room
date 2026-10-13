import { request } from '../lib/api';

export type ChatReplyKind =
  | 'answer'
  | 'fallback'
  | 'crisis'
  | 'small_talk'
  | 'out_of_scope';

export interface ChatReply {
  kind: ChatReplyKind;
  reply: string;
  /** The topic the backend recognised, or null. */
  intent: string | null;
  /** Ids of the knowledge base passages the reply was built from. */
  passageIds: string[];
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

/** The backend accepts at most this many characters per message. */
export const MAX_MESSAGE_LENGTH = 600;
/** How many earlier turns are sent along for context. */
export const MAX_HISTORY_TURNS = 8;

/**
 * Sends one question to the Support Chat. The conversation itself lives in
 * the browser and is not stored on the server.
 */
export function sendChatMessage(
  message: string,
  history: ChatTurn[],
): Promise<ChatReply> {
  return request<ChatReply>('/chat/messages', {
    method: 'POST',
    body: JSON.stringify({
      message,
      history: history.slice(-MAX_HISTORY_TURNS),
    }),
  });
}
