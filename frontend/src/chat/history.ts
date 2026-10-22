/**
 * The Support Chat conversation, kept in this browser tab only.
 *
 * It survives moving to another page and back, and a page reload, but not
 * closing the tab or signing out. Nothing is sent to or stored on the
 * server, which matches the privacy statement in the knowledge base.
 */
const PREFIX = 'ruang-pulih:chat:';

export interface StoredMessage {
  id: number;
  from: 'bot' | 'user';
  text: string;
  time: string;
  kind?: 'greeting' | 'error';
  replyKind?: string;
  intent?: string | null;
  visual?: string | null;
}

function key(userId: string) {
  return PREFIX + userId;
}

export function loadChat(userId: string | null): StoredMessage[] | null {
  if (!userId) {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(key(userId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    const messages = parsed.filter(
      (entry): entry is StoredMessage =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as StoredMessage).id === 'number' &&
        ((entry as StoredMessage).from === 'bot' ||
          (entry as StoredMessage).from === 'user') &&
        typeof (entry as StoredMessage).text === 'string' &&
        typeof (entry as StoredMessage).time === 'string',
    );
    return messages.length > 0 ? messages : null;
  } catch {
    return null;
  }
}

export function saveChat(userId: string | null, messages: StoredMessage[]) {
  if (!userId) {
    return;
  }
  try {
    window.sessionStorage.setItem(key(userId), JSON.stringify(messages));
  } catch {
    // Full or blocked storage: the conversation still works on this page.
  }
}

export function clearChat(userId: string | null) {
  if (!userId) {
    return;
  }
  try {
    window.sessionStorage.removeItem(key(userId));
  } catch {
    // Nothing to clear.
  }
}

/** On sign-out: no conversation is left behind for the next person. */
export function clearAllChats() {
  try {
    for (let i = window.sessionStorage.length - 1; i >= 0; i -= 1) {
      const name = window.sessionStorage.key(i);
      if (name?.startsWith(PREFIX)) {
        window.sessionStorage.removeItem(name);
      }
    }
  } catch {
    // Nothing to clear.
  }
}
