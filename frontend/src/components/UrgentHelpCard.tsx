import type { ReactNode } from 'react';
import { useT } from '../i18n/strings';
import { CampusIcon, HeartIcon, LifebuoyIcon, PhoneIcon } from './Icons';

/**
 * Who to contact when a student needs a person now.
 *
 * General edition: 112 is Indonesia's national emergency number, and
 * Healing119.id (119 ext. 8) is the Ministry of Health's free, 24-hour
 * mental health line. The wording awaits the psychologist's approval. The
 * campus-specific edition (PNJ) is described in for-pnj-later/PNJ-EDITION.md.
 *
 * Each route is one row: what it is for, in a few words, then the action.
 * "chat" is the narrow version for the Support Chat sidebar; "result" sits
 * on a High burnout risk result and opens with a calmer heading.
 */
export function UrgentHelpCard({
  variant,
}: {
  variant: 'chat' | 'result' | 'message';
}) {
  const t = useT();
  const title = variant === 'result' ? t.help.resultTitle : t.help.title;
  const lead = variant === 'result' ? t.help.resultLead : t.help.lead;

  return (
    <section
      className={`help-card help-card-${variant}`}
      aria-label={title}
    >
      <div className="help-head">
        <span className="help-head-icon" aria-hidden="true">
          <LifebuoyIcon size={20} />
        </span>
        <div>
          <h2 className="help-title">{title}</h2>
          <p className="help-lead">{lead}</p>
        </div>
      </div>

      <ul className="help-list">
        <HelpRow
          icon={<PhoneIcon size={18} />}
          title={t.help.danger}
          text={t.help.dangerText}
          action={
            <a className="help-action help-action-strong" href="tel:112">
              {t.help.call112}
            </a>
          }
        />
        <HelpRow
          icon={<HeartIcon size={18} />}
          title={t.help.counsellor}
          text={t.help.counsellorText}
          action={
            <div className="help-actions">
              {/* The comma makes the phone pause, then dial extension 8. */}
              <a className="help-action" href="tel:119,8">
                {t.help.call119}
              </a>
              <a
                className="help-action help-action-quiet"
                href="https://healing119.id"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.help.website}
              </a>
            </div>
          }
        />
        <HelpRow
          icon={<CampusIcon size={18} />}
          title={t.help.campus}
          text={t.help.campusText}
          keepText
        />
      </ul>
    </section>
  );
}

function HelpRow({
  icon,
  title,
  text,
  action,
  keepText = false,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
  /** In the compact card, rows with an action drop their description. */
  keepText?: boolean;
}) {
  return (
    <li className="help-row">
      <span className="help-row-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="help-row-body">
        <strong>{title}</strong>
        <span className={keepText ? 'help-row-text keep' : 'help-row-text'}>
          {text}
        </span>
        {action}
      </div>
    </li>
  );
}
