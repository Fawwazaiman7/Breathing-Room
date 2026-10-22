import { useT } from '../i18n/strings';
import { CONTACTS } from '../support/contacts';
import type { ContactId } from '../support/contacts';
import {
  CampusIcon,
  HeartIcon,
  LifebuoyIcon,
  PeopleIcon,
  PhoneIcon,
} from './Icons';

const CONTACT_ICON: Record<ContactId, typeof PhoneIcon> = {
  emergency: LifebuoyIcon,
  befrienders: HeartIcon,
  heal: PeopleIcon,
};

/**
 * Mental health contacts, set out like a phone book: who it is, when it
 * is open, and the number itself as the button. The number is visible, so
 * it can also be dialled from another phone or written down.
 *
 * - "chat": the Support Chat sidebar (no notes, to stay short).
 * - "result": a High burnout risk result, with a calmer heading.
 * - "message": under a crisis reply in the chat.
 * - "reply": under a chat reply that sends the student to a service.
 */
export function UrgentHelpCard({
  variant,
}: {
  variant: 'chat' | 'result' | 'message' | 'reply';
}) {
  const t = useT();
  const title =
    variant === 'result'
      ? t.help.resultTitle
      : variant === 'reply'
        ? t.help.replyTitle
        : t.help.title;
  const lead =
    variant === 'result'
      ? t.help.resultLead
      : variant === 'reply'
        ? null
        : t.help.lead;
  // A reply about counselling does not need the emergency number first.
  const contacts =
    variant === 'reply'
      ? CONTACTS.filter((contact) => !contact.urgent)
      : CONTACTS;

  return (
    <section
      className={`help-card help-card-${variant}`}
      aria-label={title}
    >
      <div className="help-head">
        <span className="help-head-icon" aria-hidden="true">
          <PhoneIcon size={18} />
        </span>
        <div>
          <h2 className="help-title">{title}</h2>
          {lead && <p className="help-lead">{lead}</p>}
          <p className="help-region">{t.help.region}</p>
        </div>
      </div>

      <ul className="contact-list">
        {contacts.map((contact) => {
          const text = t.help.contacts[contact.id];
          const Icon = CONTACT_ICON[contact.id];
          return (
            <li
              key={contact.id}
              className={contact.urgent ? 'contact urgent' : 'contact'}
            >
              <span className="contact-icon" aria-hidden="true">
                <Icon size={18} />
              </span>
              <span className="contact-text">
                <strong>{text.name}</strong>
                <span className="contact-note">{text.note}</span>
                <span className="contact-hours">{text.hours}</span>
              </span>
              <a
                className="contact-number"
                href={`tel:${contact.tel}`}
                aria-label={t.help.callLabel(text.name, contact.number)}
              >
                <PhoneIcon size={16} />
                <span>{contact.number}</span>
              </a>
            </li>
          );
        })}
        {variant !== 'reply' && (
          <li className="contact contact-campus">
            <span className="contact-icon" aria-hidden="true">
              <CampusIcon size={18} />
            </span>
            <span className="contact-text">
              <strong>{t.help.campus}</strong>
              <span className="contact-note keep">{t.help.campusText}</span>
            </span>
          </li>
        )}
      </ul>
    </section>
  );
}
