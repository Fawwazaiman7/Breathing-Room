import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useAuth } from '../auth/useAuth';
import { MAX_MESSAGE_LENGTH, sendChatMessage } from '../chat/api';
import type { ChatTurn } from '../chat/api';
import '../chat/chat.css';
import { ChevronRightIcon, InfoIcon, SendIcon } from '../components/Icons';
import { ApiError } from '../lib/api';
import { usePageTitle } from '../lib/usePageTitle';

const TOPICS = [
  'Academic burnout',
  'Workload',
  'Exhaustion and disengagement',
  'Time management',
  'My screening result',
  'Student support',
];

interface Message {
  id: number;
  from: 'bot' | 'user';
  text: string;
  time: string;
  /** 'greeting' and 'error' entries are shown but never sent as history. */
  kind?: 'greeting' | 'error';
  /** A student message that has no reply yet (still waiting, or failed). */
  unanswered?: boolean;
  /** On an error entry: the id of the student message to send again. */
  retryId?: number;
}

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
});
const now = () => timeFormat.format(new Date());

/** Shows web addresses in a reply as links; everything else stays plain text. */
function withLinks(text: string): ReactNode[] {
  return text.split(/(https?:\/\/[^\s)]+)/g).map((part, index) => {
    if (!/^https?:\/\//.test(part)) {
      return part;
    }
    const url = part.replace(/[.,;:!?]+$/, '');
    return (
      <span key={index}>
        <a href={url} target="_blank" rel="noopener noreferrer">
          {url}
        </a>
        {part.slice(url.length)}
      </span>
    );
  });
}

export function SupportChatPage() {
  usePageTitle('Support chat');
  const { profile } = useAuth();
  const firstName = profile?.full_name.trim().split(/\s+/)[0] ?? '';
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: 0,
      from: 'bot',
      kind: 'greeting',
      text: `Hi${firstName ? ` ${firstName}` : ''}. I’m here to help with general questions about academic burnout, your screening summary, or support available at PNJ. What would be useful to talk through?`,
      time: now(),
    },
  ]);
  const [draft, setDraft] = useState('');
  const [waiting, setWaiting] = useState(false);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, waiting]);

  /** Sends one student message (already in the thread) and adds the reply. */
  async function deliver(userId: number, text: string, history: ChatTurn[]) {
    setWaiting(true);
    try {
      const reply = await sendChatMessage(text, history);
      const botId = nextId.current++;
      setMessages((current) => [
        ...current.map((entry) =>
          entry.id === userId ? { ...entry, unanswered: false } : entry,
        ),
        { id: botId, from: 'bot', text: reply.reply, time: now() },
      ]);
    } catch (error) {
      const noteId = nextId.current++;
      setMessages((current) => [
        ...current,
        {
          id: noteId,
          from: 'bot',
          kind: 'error',
          retryId: userId,
          time: now(),
          text:
            error instanceof ApiError && error.status !== 0
              ? error.message
              : 'Could not reach the Support Chat. Please check your connection and try again.',
        },
      ]);
    }
    setWaiting(false);
  }

  /** Completed turns only: no greeting, no error notes, no unanswered message. */
  function historyOf(entries: Message[]): ChatTurn[] {
    return entries
      .filter((entry) => !entry.kind && !entry.unanswered)
      .map((entry) => ({
        role: entry.from === 'user' ? 'user' : 'assistant',
        text: entry.text,
      }));
  }

  function send(text: string) {
    const message = text.trim();
    if (!message || waiting) {
      return;
    }
    const userId = nextId.current++;
    // An earlier error note is cleared when the student writes again.
    const kept = messages.filter((entry) => entry.kind !== 'error');
    setMessages([
      ...kept,
      { id: userId, from: 'user', text: message, time: now(), unanswered: true },
    ]);
    setDraft('');
    void deliver(userId, message, historyOf(kept));
  }

  function retry(note: Message) {
    const failed = messages.find((entry) => entry.id === note.retryId);
    if (!failed || waiting) {
      return;
    }
    const kept = messages.filter((entry) => entry.kind !== 'error');
    setMessages(kept);
    void deliver(failed.id, failed.text, historyOf(kept));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(draft);
  }

  return (
    <div className="chat-page">
      <header className="chat-header">
        <p className="eyebrow">Student support</p>
        <h1 className="chat-title">Support chat</h1>
        <p className="chat-lead">
          Answers general questions about academic burnout and student
          support. It can’t change your screening result.
        </p>
      </header>

      <div className="chat-layout">
        <aside className="chat-topics" aria-labelledby="chat-topics-title">
          <h2 id="chat-topics-title">Suggested topics</h2>
          <p>Choose a topic to start the conversation.</p>
          <ul>
            {TOPICS.map((topic) => (
              <li key={topic}>
                <button
                  type="button"
                  disabled={waiting}
                  onClick={() =>
                    send(
                      `I’d like to talk about ${topic.charAt(0).toLowerCase()}${topic.slice(1)}.`,
                    )
                  }
                >
                  {topic}
                  <ChevronRightIcon size={16} />
                </button>
              </li>
            ))}
          </ul>
          <p className="chat-urgent">
            <InfoIcon size={18} />
            <span>
              If you feel unsafe or in crisis, do not wait for a reply here.
              Contact local emergency services, or message Layanan Psikologis
              PNJ on WhatsApp at +62 823-7957-4919 during working hours.
            </span>
          </p>
        </aside>

        <section className="chat-window" aria-label="Conversation">
          <div className="chat-messages" role="log" aria-live="polite">
            <p className="chat-day">Today</p>
            {messages.map((entry) => (
              <div
                key={entry.id}
                className={`chat-message chat-message-${entry.from}${entry.kind === 'error' ? ' chat-message-error' : ''}`}
              >
                <div>
                  <p className="chat-bubble">{withLinks(entry.text)}</p>
                  {entry.kind === 'error' && (
                    <button
                      type="button"
                      className="link-button chat-retry"
                      disabled={waiting}
                      onClick={() => retry(entry)}
                    >
                      Try again
                    </button>
                  )}
                  <p className="chat-meta">
                    {entry.from === 'bot' ? 'Support assistant' : 'You'} ·{' '}
                    {entry.time}
                  </p>
                </div>
              </div>
            ))}
            {waiting && (
              <div className="chat-message chat-message-bot">
                <div>
                  <p className="chat-bubble chat-typing">Writing a reply…</p>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form className="chat-composer" onSubmit={handleSubmit}>
            <div className="chat-input-row">
              <input
                aria-label="Message Support chat"
                placeholder="Ask a question..."
                maxLength={MAX_MESSAGE_LENGTH}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button
                type="submit"
                aria-label="Send message"
                disabled={waiting || draft.trim() === ''}
              >
                <SendIcon size={20} />
              </button>
            </div>
            <p className="chat-note">
              AI can make mistakes. For personal guidance, speak with your
              Academic Advisor.
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}
