/**
 * Mental health contacts shown in the app.
 *
 * General edition, set up for the presentation at MSU, Malaysia:
 * - 999: the Malaysian emergency number.
 * - Befrienders Kuala Lumpur, 03-7627 2929, open 24 hours
 *   (befrienders.org.my).
 * - Talian HEAL 15555, Ministry of Health Malaysia, daily from 8 am to
 *   midnight (The Star, 9 July 2026).
 * The wording awaits the psychologist's approval. The PNJ edition is
 * described in backend/for-pnj-later/PNJ-EDITION.md.
 */
export type ContactId = 'emergency' | 'befrienders' | 'heal';

export interface Contact {
  id: ContactId;
  /** The number as people read it. */
  number: string;
  /** The number for a tel: link. */
  tel: string;
  /** Shown first and in the strongest colour. */
  urgent?: boolean;
}

export const CONTACTS: Contact[] = [
  { id: 'emergency', number: '999', tel: '999', urgent: true },
  { id: 'befrienders', number: '03-7627 2929', tel: '+60376272929' },
  { id: 'heal', number: '15555', tel: '15555' },
];

/**
 * A reply that sends the student to a service gets the contacts under it,
 * so the next step is one tap away. English, Indonesian and Malay words.
 */
export const MENTIONS_A_SERVICE =
  /\b(counsel\w*|konsel\w*|kaunsel\w*|befrienders|heal|hotline|helpline|emergency|darurat|kecemasan|crisis|krisis|psycholog\w*|psikolog\w*|talk to someone|bicara dengan seseorang)\b/i;
