/**
 * Messages that suggest a student may be in danger are never sent to the
 * language model. They get a fixed reply that points to people who can
 * help. The wording below mirrors knowledge base passage SS-16 and SS-06
 * and, like them, needs the campus psychologist's approval.
 */

const CRISIS_PATTERNS_EN: RegExp[] = [
  /\bsuicid/i,
  /\bkill(ing)? myself\b/i,
  /\b(end|ending|take|taking) my (own )?life\b/i,
  /\b(want|wanted|wanna|wish) (to )?(die|be dead)\b/i,
  /\b(hurt|hurting|harm|harming|cut|cutting) myself\b/i,
  /\bself[- ]harm/i,
  /\bbetter off dead\b/i,
  /\bno reason to live\b/i,
  /\b(don'?t|do not) want to (live|be alive|be here anymore)\b/i,
];

const CRISIS_PATTERNS_ID: RegExp[] = [
  /\bbunuh diri\b/i,
  /\b(meng)?akhiri hidup/i,
  /\b(ingin|pengen|pengin|kepengen|mau|pingin) mati\b/i,
  /\b(menyakiti|melukai|nyakitin|sakiti|lukai) diri/i,
  /\b(tidak|tak|gak|ga|nggak|enggak|ngga) (ingin|mau|pengen|pengin) hidup/i,
  /\b(lebih baik|mending) mati\b/i,
];

export function detectCrisis(message: string): boolean {
  return [...CRISIS_PATTERNS_EN, ...CRISIS_PATTERNS_ID].some((pattern) =>
    pattern.test(message),
  );
}

const INDONESIAN_WORDS =
  /\b(saya|aku|gue|gua|kamu|tidak|nggak|gak|enggak|yang|dan|atau|ini|itu|apa|bagaimana|gimana|kenapa|mengapa|ingin|pengen|mau|bisa|sudah|udah|belum|lagi|banget|sangat|capek|lelah|tugas|kuliah|dosen|hasil|skrining|dengan|untuk|karena|kalau|jadi|juga|sama|ada|harus|perlu|tolong)\b/gi;

/**
 * Rough language check for the fixed replies (the language model handles
 * its own replies). Two common Indonesian words are enough.
 */
export function looksIndonesian(message: string): boolean {
  return (message.match(INDONESIAN_WORDS) ?? []).length >= 2;
}

/**
 * General edition: no campus-specific contact. 112 is Indonesia's national
 * emergency number; Healing119.id (119 ext. 8) is the Ministry of Health's
 * free 24-hour mental health line. Awaiting the psychologist's approval.
 * The PNJ edition is in for-pnj-later/PNJ-EDITION.md.
 */
export const CRISIS_REPLY = {
  en: [
    'Thank you for telling me. What you are feeling matters, and right now you deserve support from a person, not from a chatbot.',
    'If you are in immediate danger, please call 112 or go to the nearest emergency department, and tell someone you trust who is near you.',
    'You can also call Healing119.id at 119, extension 8. It is a free mental health service from the Ministry of Health, open 24 hours. Your campus counselling service can support you too.',
  ].join('\n\n'),
  id: [
    'Terima kasih sudah menceritakannya. Apa yang kamu rasakan itu penting, dan saat ini kamu layak mendapat dukungan langsung dari seseorang, bukan dari chatbot.',
    'Kalau kamu sedang dalam bahaya, segera hubungi 112 atau datang ke IGD terdekat, dan beri tahu orang yang kamu percaya di dekatmu.',
    'Kamu juga bisa menghubungi Healing119.id di nomor 119, ekstensi 8. Layanan kesehatan jiwa dari Kementerian Kesehatan ini gratis dan buka 24 jam. Layanan konseling di kampusmu juga bisa membantumu.',
  ].join('\n\n'),
};

/**
 * Greetings and thanks are not questions, so nothing is looked up for them.
 * Only very short messages count: "hi, why am I so tired?" is a question.
 */
export type SmallTalk = 'greeting' | 'thanks';

const GREETING =
  /^(hi|hello|hey|hai|halo|hallo|helo|hei|p|pagi|siang|sore|malam|selamat (pagi|siang|sore|malam)|good (morning|afternoon|evening)|assalamu ?'?alaikum( wr\.? ?wb\.?)?|permisi|test|tes)( (there|kak|min|bot|claude))?$/;
const THANKS =
  /^((ok|oke|okay|okey|baik|sip|siap|alright|great|nice|mantap)[ ,]*)?(thanks|thank you|thank u|thx|ty|makasih|makasi|terima ?kasih|trims|tengkyu)( (a lot|so much|very much|banyak|banyak ya|ya|yaa|kak|min|bot))*$|^(ok|oke|okay|okey|baik|sip|siap)( (deh|kak|ya))?$/;

export function detectSmallTalk(message: string): SmallTalk | null {
  const text = message
    .toLowerCase()
    .replace(/[.!?,~:;()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text === '' || text.split(' ').length > 5) {
    return null;
  }
  if (GREETING.test(text)) {
    return 'greeting';
  }
  if (THANKS.test(text)) {
    return 'thanks';
  }
  return null;
}

const INDONESIAN_SMALL_TALK =
  /\b(hai|halo|hallo|helo|pagi|siang|sore|malam|selamat|permisi|tes|makasih|makasi|terima ?kasih|trims|tengkyu|oke|baik|sip|siap|kak|min|ya|deh|banyak|alaikum)\b/i;

/** looksIndonesian() needs two words; small talk is often a single one. */
export function smallTalkLanguage(message: string): 'en' | 'id' {
  return INDONESIAN_SMALL_TALK.test(message) ? 'id' : 'en';
}

export const SMALL_TALK_REPLY: Record<SmallTalk, { en: string; id: string }> = {
  greeting: {
    en: 'Hello. I can help with questions about academic burnout, workload, exhaustion and disengagement, time management, your screening result, and student support. What would you like to ask?',
    id: 'Halo. Saya bisa membantu dengan pertanyaan tentang burnout akademik, beban kerja, kelelahan dan ketidakterlibatan, manajemen waktu, hasil skrining, dan dukungan mahasiswa. Apa yang ingin kamu tanyakan?',
  },
  thanks: {
    en: 'You are welcome. I am here if you have another question.',
    id: 'Sama-sama. Saya di sini kalau ada pertanyaan lain.',
  },
};

export const OUT_OF_SCOPE_REPLY = {
  en: 'I can help with questions about academic burnout, workload, exhaustion and disengagement, time management, your screening result, and student support. Could you ask about one of those?',
  id: 'Saya bisa membantu dengan pertanyaan tentang burnout akademik, beban kerja, kelelahan dan ketidakterlibatan, manajemen waktu, hasil skrining, dan dukungan mahasiswa. Boleh tanyakan salah satunya?',
};

export const FALLBACK_REPLY = {
  en: {
    withPassage:
      'I could not put a full answer together just now. Here is what I can share:',
    empty: 'I could not answer that just now. Please try again in a moment.',
  },
  id: {
    withPassage:
      'Saya belum bisa menyusun jawaban lengkap saat ini. Ini informasi yang bisa saya bagikan (dalam bahasa Inggris):',
    empty: 'Saya belum bisa menjawabnya saat ini. Silakan coba lagi sebentar lagi.',
  },
};
