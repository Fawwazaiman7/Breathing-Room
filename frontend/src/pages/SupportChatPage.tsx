import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../auth/useAuth';
import { MAX_MESSAGE_LENGTH, sendChatMessage } from '../chat/api';
import type { ChatReplyKind, ChatTurn } from '../chat/api';
import '../chat/chat.css';
import { clearChat, loadChat, saveChat } from '../chat/history';
import {
  ReplyBody,
  ReplyVisual,
  TopicBanner,
  visualFor,
} from '../chat/ReplyParts';
import type { ReplyVisualKind } from '../chat/ReplyParts';
import { ChevronRightIcon, PlusIcon, SendIcon } from '../components/Icons';
import { UrgentHelpCard } from '../components/UrgentHelpCard';
import { localeOf, useLanguage } from '../i18n/language';
import { translateMessage } from '../i18n/messages';
import { useT } from '../i18n/strings';
import { MENTIONS_A_SERVICE } from '../support/contacts';
import { ApiError } from '../lib/api';
import { usePageTitle } from '../lib/usePageTitle';

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
  /** On a reply: what the backend did, and the topic it recognised. */
  replyKind?: ChatReplyKind;
  intent?: string | null;
  /** A small picture shown under the reply, chosen when it arrives. */
  visual?: ReplyVisualKind | null;
}

export function SupportChatPage() {
  const t = useT();
  const { language } = useLanguage();
  usePageTitle(t.titles.chat);
  const { profile } = useAuth();
  const firstName = profile?.full_name.trim().split(/\s+/)[0] ?? '';

  const timeFormat = new Intl.DateTimeFormat(localeOf(language), {
    hour: '2-digit',
    minute: '2-digit',
  });
  const now = () => timeFormat.format(new Date());

  const userId = profile?.id ?? null;
  const greeting = (): Message[] => [
    { id: 0, from: 'bot', kind: 'greeting', text: '', time: now() },
  ];
  // The conversation is kept in this browser tab, so it is still here after
  // visiting another page. A message that was still waiting is dropped.
  const [messages, setMessages] = useState<Message[]>(() => {
    const stored = loadChat(userId) as Message[] | null;
    return stored ?? greeting();
  });
  const [draft, setDraft] = useState('');
  const [waiting, setWaiting] = useState(false);
  const nextId = useRef(
    Math.max(0, ...messages.map((entry) => entry.id)) + 1,
  );

  useEffect(() => {
    saveChat(
      userId,
      messages.filter((entry) => !entry.unanswered && entry.kind !== 'error'),
    );
  }, [userId, messages]);

  function startOver() {
    if (waiting) {
      return;
    }
    clearChat(userId);
    nextId.current = 1;
    setMessages(greeting());
    setDraft('');
  }
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
      setMessages((current) => {
        // Pictures that explain a topic are shown once per conversation;
        // the result card is shown whenever the result is discussed.
        const shown = new Set(current.map((entry) => entry.visual));
        const visual = visualFor(reply.kind, reply.intent, text, shown);
        return [
          ...current.map((entry) =>
            entry.id === userId ? { ...entry, unanswered: false } : entry,
          ),
          {
            id: botId,
            from: 'bot',
            text: reply.reply,
            time: now(),
            replyKind: reply.kind,
            intent: reply.intent,
            visual,
          },
        ];
      });
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
              : '',
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

  /** The text shown for an entry; the greeting and errors follow the language. */
  function textOf(entry: Message): string {
    if (entry.kind === 'greeting') {
      return t.chat.greeting(firstName);
    }
    if (entry.kind === 'error') {
      return entry.text
        ? translateMessage(entry.text, language)
        : t.chat.unreachable;
    }
    return entry.text;
  }

  return (
    <div className="chat-page">
      <header className="chat-header">
        <p className="eyebrow">{t.chat.kicker}</p>
        <h1 className="chat-title">{t.chat.title}</h1>
        <p className="chat-lead">{t.chat.lead}</p>
        {messages.length > 1 && (
          <button
            type="button"
            className="button-secondary chat-new"
            onClick={startOver}
            disabled={waiting}
          >
            <PlusIcon size={16} /> {t.chat.newChat}
          </button>
        )}
      </header>

      <div className="chat-layout">
        <aside className="chat-topics" aria-labelledby="chat-topics-title">
          <h2 id="chat-topics-title">{t.chat.topicsTitle}</h2>
          <p>{t.chat.topicsText}</p>
          <ul>
            {t.chat.topics.map((topic) => (
              <li key={topic}>
                <button
                  type="button"
                  disabled={waiting}
                  onClick={() => send(t.chat.topicMessage(topic))}
                >
                  {topic}
                  <ChevronRightIcon size={16} />
                </button>
              </li>
            ))}
          </ul>
          <UrgentHelpCard variant="chat" />
        </aside>

        <section className="chat-window" aria-label={t.chat.conversation}>
          <div className="chat-messages" role="log" aria-live="polite">
            <p className="chat-day">{t.chat.today}</p>
            {messages.map((entry) => {
              const crisis = entry.replyKind === 'crisis';
              const text = textOf(entry);
              return (
                <div
                  key={entry.id}
                  className={`chat-message chat-message-${entry.from}${entry.kind === 'error' ? ' chat-message-error' : ''}`}
                >
                  <div className="chat-message-body">
                    {entry.from === 'bot' &&
                      entry.intent &&
                      (entry.replyKind === 'answer' ||
                        entry.replyKind === 'fallback') && (
                        <TopicBanner intent={entry.intent} />
                      )}
                    {entry.from === 'bot' ? (
                      <div className="chat-bubble">
                        {/* A crisis reply keeps its first, personal paragraph;
                            the contacts follow as a card. */}
                        <ReplyBody
                          text={crisis ? text.split(/\n{2,}/)[0] : text}
                          intent={entry.intent}
                        />
                      </div>
                    ) : (
                      <p className="chat-bubble">{text}</p>
                    )}
                    {crisis && <UrgentHelpCard variant="message" />}
                    {/* A reply that points to a service brings its numbers. */}
                    {!crisis &&
                      entry.from === 'bot' &&
                      (entry.replyKind === 'answer' ||
                        entry.replyKind === 'fallback') &&
                      MENTIONS_A_SERVICE.test(entry.text) && (
                        <UrgentHelpCard variant="reply" />
                      )}
                    {entry.visual && <ReplyVisual kind={entry.visual} />}
                    {entry.kind === 'error' && (
                      <button
                        type="button"
                        className="link-button chat-retry"
                        disabled={waiting}
                        onClick={() => retry(entry)}
                      >
                        {t.chat.tryAgain}
                      </button>
                    )}
                    <p className="chat-meta">
                      {entry.from === 'bot' ? t.chat.assistant : t.chat.you} ·{' '}
                      {entry.time}
                    </p>
                  </div>
                </div>
              );
            })}
            {waiting && (
              <div className="chat-message chat-message-bot">
                <div className="chat-message-body">
                  <p className="chat-bubble chat-typing">{t.chat.writing}</p>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form className="chat-composer" onSubmit={handleSubmit}>
            <div className="chat-input-row">
              <input
                aria-label={t.chat.inputLabel}
                placeholder={t.chat.placeholder}
                maxLength={MAX_MESSAGE_LENGTH}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button
                type="submit"
                aria-label={t.chat.send}
                disabled={waiting || draft.trim() === ''}
              >
                <SendIcon size={20} />
              </button>
            </div>
            <p className="chat-note">
              {t.chat.disclaimer} {t.chat.keptNote}
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}
