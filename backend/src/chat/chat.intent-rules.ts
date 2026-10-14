import type { ChatIntent } from './chat.types.js';

/**
 * Keyword rules that decide an intent before the nearest-neighbour vote.
 *
 * Some questions name something that settles the intent whatever other
 * words surround it: a question that mentions the Academic Advisor is about
 * student support even when it also contains "result" or "exhaustion".
 * Similarity alone often follows the other words, so these cases are
 * decided by rule. Every other question goes to the vote.
 *
 * The rules are the written conventions of kb/INTENTS.md turned into code.
 * They are checked in the order below and the first match wins, so the
 * order is part of the rule: people and services come before the result,
 * the result before the questionnaires, and then what the question itself
 * is about: managing time, a state the student voices, the amount of work.
 *
 * Deterministic and language-model free, like the vote.
 */

export interface IntentRule {
  /** Short name shown in logs and in the evaluation report. */
  id: string;
  intent: ChatIntent;
  /** What the rule covers, in plain words. */
  description: string;
  matches(text: string): boolean;
}

// "dosen pembimbing" alone is left to the vote: it can also be a project
// or thesis supervisor in a question about workload.
const ADVISOR =
  /\b(?:dpa|dosen pa|dosen wali|dosen pembimbing akademik|pembimbing akademik|academic advis[eo]rs?|(?:my|the|your|an) advis[eo]rs?)(?:nya)?\b/i;

// A bare "psychologist" is left to the vote: "what do psychologists say
// burnout is?" is a question about burnout.
const COUNSELLING =
  /\b(?:konseling|konselor|counsell?ing|counsell?ors?|layanan psikologis|psychological services?|hotline)(?:nya)?\b/i;

const PRIVACY =
  /\b(?:who (?:else )?can see|siapa (?:saja |aja )?yang (?:bisa|dapat|boleh) (?:lihat|melihat|liat|akses|mengakses)|privacy|privasi|confidential(?:ity)?|kerahasiaan|dirahasiakan|personal data|data pribadi)\b/i;
// "data" is an everyday word for IT students ("my database assignment"), so
// it counts only as data about the student, together with a word about
// keeping it safe.
const DATA_ABOUT_ME =
  /\bmy (?:personal |private |psychological |screening |mental health )?data\b|\bdata (?:psikologis |skrining |kesehatan mental )?(?:saya|aku|ku|gue)\b/i;
const KEPT_SAFE =
  /\b(?:safe|secure|stored|shared|private|protected|leak(?:ed)?|aman|disimpan|dibagikan|dilindungi|bocor|rahasia|dilihat)\b/i;

const SOMEONE_ELSE =
  /\b(?:my|a|our|one of my) (?:best |close )?(?:friend|classmate|roommate|coursemate)s?\b|\b(?:teman|temen|sahabat|kawan)(?: (?:sekelas|sekamar|dekat|kos|kuliah))? (?:saya|aku|ku|gue|gw)\b|\b(?:temanku|temenku|sahabatku)\b/i;
const CONCERN_OR_HELP =
  /\b(?:help|support|looks?|seems?|what (?:should|can) i do|bantu|membantu|menolong|tolong|kelihatan|keliatan|terlihat|sepertinya|kayaknya|harus (?:gimana|bagaimana|apa)|bisa (?:apa|bantu))\b/i;

const RESULT_WORD = /\b(?:results?|hasil(?:nya)?|kategori|category)\b/i;
const CATEGORY_NAME =
  /\b(?:no burnout|(?:low|moderate|high)[- ](?:burn-?out[- ])?risk|tidak (?:mengalami |ada )?burnout|r[ie]siko (?:rendah|sedang|tinggi))\b/i;
// "test result" alone is left to the vote: it can be an exam.
const SCREENING_RESULT_PHRASE =
  /\b(?:screening|skrining) results?\b|\bhasil (?:skrining|screening)\b/i;

const WORKLOAD_INSTRUMENT =
  /\b(?:nasa[- ]?tlx|(?:mental|physical|temporal) demands?|effort dimension|frustration (?:dimension|level|score)|dimensi (?:mental demand|physical demand|temporal demand|effort|frustration|performance|usaha|frustrasi|performa)|tuntutan (?:mental|fisik|waktu)|workload (?:score|questionnaire|level|category)|(?:skor|kuesioner|kategori|tingkat) beban kerja)\b/i;

const OLBI_INSTRUMENT =
  /\b(?:olbi|oldenburg|(?:exhaustion|disengagement) (?:score|dimension|level)|(?:skor|dimensi|tingkat) (?:exhaustion|disengagement|kelelahan|ketidakterlibatan))\b/i;

// The student says they are tired, or names exhaustion or disengagement.
// A question that also names burnout or time management is left to the
// vote, because it may be asking about that other topic. Words that are
// also used of things ("my time is drained") are left to the vote too.
const TIREDNESS =
  /\b(?:exhaust(?:ed|ion|ing)|tired|disengage(?:d|ment)|lelah|kelelahan|capek|kecapekan|letih|ketidakterlibatan)\b/i;
const OTHER_TOPIC_NAMED =
  /\b(?:burn(?:ed|t)?[- ]?out|time management|manajemen waktu)\b/i;

// The question names managing time itself. What a question asks about
// decides its intent, so "does time management prevent burnout?" is about
// time management, and so is "how do I manage my time when tasks pile up?".
const TIME_NAMED =
  /\b(?:time[- ]management|manag(?:e|ing) (?:my |your |our )?time|divid(?:e|ing) (?:my |your |our )?time|manajemen waktu|(?:meng|ng)?atur waktu(?:nya|ku)?|(?:mem)?bagi waktu(?:nya|ku)?|pembagian waktu)\b/i;

// The question is about the work itself being too much: a word for study
// work together with a word for quantity or collision. Time management may
// be one answer to it, but the work is what the question is about.
const STUDY_WORK =
  /\b(?:assignments?|tasks?|projects?|coursework|homework|deadlines?|workload|tugas|proyek|projek|kerjaan|pbl|praktikum|laporan|beban (?:kuliah|kerja|tugas))\b/i;
const TOO_MUCH =
  /\b(?:pil(?:e|es|ed|ing) up|too many|too much|so many|so much|overload(?:ed)?|clash(?:es|ed|ing)?|menumpuk|numpuk|bertumpuk|terlalu banyak|kebanyakan|banyak (?:banget|sekali|bgt)|berat (?:banget|sekali|bgt)|bentrok|bertabrakan|tabrakan|barengan|bersamaan)\b/i;

export const INTENT_RULES: readonly IntentRule[] = [
  {
    id: 'SS-ADVISOR',
    intent: 'STUDENT_SUPPORT',
    description: 'Mentions the Academic Advisor (DPA, dosen PA, dosen pembimbing akademik, advisor).',
    matches: (text) => ADVISOR.test(text),
  },
  {
    id: 'SS-COUNSELLING',
    intent: 'STUDENT_SUPPORT',
    description: 'Mentions counselling, a counsellor, or the psychological service.',
    matches: (text) => COUNSELLING.test(text),
  },
  {
    id: 'SS-PRIVACY',
    intent: 'STUDENT_SUPPORT',
    description: "Asks who can see something, or about privacy, confidentiality or the student's own data.",
    matches: (text) =>
      PRIVACY.test(text) || (DATA_ABOUT_ME.test(text) && KEPT_SAFE.test(text)),
  },
  {
    id: 'SS-SOMEONE-ELSE',
    intent: 'STUDENT_SUPPORT',
    description: 'Is about a friend or classmate, and expresses concern for them or asks how to help.',
    matches: (text) => SOMEONE_ELSE.test(text) && CONCERN_OR_HELP.test(text),
  },
  {
    id: 'SR-CATEGORY',
    intent: 'SCREENING_RESULT',
    description: 'Names the screening result, or a result together with one of the four categories.',
    matches: (text) =>
      SCREENING_RESULT_PHRASE.test(text) ||
      (RESULT_WORD.test(text) && CATEGORY_NAME.test(text)),
  },
  {
    id: 'WL-INSTRUMENT',
    intent: 'WORKLOAD',
    description: 'Names NASA-TLX, one of its dimensions, or the workload score.',
    matches: (text) => WORKLOAD_INSTRUMENT.test(text),
  },
  {
    id: 'ED-INSTRUMENT',
    intent: 'EXHAUSTION_DISENGAGEMENT',
    description: 'Names OLBI, or the exhaustion or disengagement score.',
    matches: (text) => OLBI_INSTRUMENT.test(text),
  },
  {
    id: 'TM-NAMED',
    intent: 'TIME_MANAGEMENT',
    description: 'Names managing, dividing or organising time.',
    matches: (text) => TIME_NAMED.test(text),
  },
  {
    id: 'ED-STATE',
    intent: 'EXHAUSTION_DISENGAGEMENT',
    description: 'Says the student is tired, or names exhaustion or disengagement, without naming burnout or time management.',
    matches: (text) => TIREDNESS.test(text) && !OTHER_TOPIC_NAMED.test(text),
  },
  {
    id: 'WL-QUANTITY',
    intent: 'WORKLOAD',
    description: 'Says that study work (assignments, projects, deadlines) is too much, piling up or clashing.',
    matches: (text) => STUDY_WORK.test(text) && TOO_MUCH.test(text),
  },
];

export interface IntentRuleMatch {
  rule: string;
  intent: ChatIntent;
}

/** The first rule that matches the message, or null when none does. */
export function matchIntentRule(message: string): IntentRuleMatch | null {
  const text = message.replace(/\s+/g, ' ').trim();
  for (const rule of INTENT_RULES) {
    if (rule.matches(text)) {
      return { rule: rule.id, intent: rule.intent };
    }
  }
  return null;
}
