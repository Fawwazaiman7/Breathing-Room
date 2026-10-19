# Ruang Pulih: general edition and PNJ edition

For the final-project presentation the app runs as a **general edition**: no
campus is named, and support points to "your campus counselling service".
After the presentation it can be switched back to the PNJ edition. Every
place that changed is listed here, with the PNJ wording to restore.

All contact details below need the campus psychologist's approval before
real students use them.

## Backend

| File | General edition (now) | PNJ edition |
|---|---|---|
| `src/screening/rule-engine/rule-base.ts`, `RECOMMENDATIONS.CURATIVE` | `Kuratif dengan rujukan konseling ke layanan konseling kampus` / `Curative: counselling referral to the campus counselling service` | `Kuratif dengan rujukan konseling ke BK PNJ` / `Curative: counselling referral to the PNJ Counselling Unit (BK PNJ)` |
| `src/feedback/feedback.context.ts`, `PLAIN_RECOMMENDATIONS.CURATIVE` (and `_ID`) | `Go for counselling at the campus counselling service…` | `Go for counselling at the PNJ Counselling Unit (BK PNJ)…` / `Mengikuti konseling di Unit Konseling PNJ (BK PNJ)…` |
| `src/chat/chat.safety.ts`, `CRISIS_REPLY` | 112, Healing119.id (119 ext. 8), campus counselling service | Layanan Psikologis PNJ, WhatsApp +62 823-7957-4919, Monday to Friday 08.00–16.00 WIB |
| `src/chat/chat.safety.ts`, small talk and out-of-scope replies | "…and student support." | "…and student support at PNJ." |
| `src/chat/chat.prompt.ts`, rule 4 and first line | "a study wellbeing app for university students"; "Name only services that are written in the passages" | "for students of Politeknik Negeri Jakarta (PNJ)"; "The counselling service is called "Layanan Psikologis PNJ". Write that name as it is and never translate it." |
| `test-cases/rule-base-cases.json` | general CURATIVE wording | PNJ CURATIVE wording |

## Knowledge base

`kb/knowledge-base.json` now holds general versions of SS-04 to SS-13 and
SS-16. The PNJ versions are in `for-pnj-later/knowledge-base-pnj.json`
(the whole file as it was on 19 October 2026). To switch back, copy that
file over `kb/knowledge-base.json` and run `node kb/index-kb.mjs`.

Changing passages changes their embeddings, so after either switch run
`node kb/evaluate-chat.mjs` again and use the new figures.

## Frontend

| File | General edition (now) | PNJ edition |
|---|---|---|
| `src/components/UrgentHelpCard.tsx` and `help` texts in `src/i18n/strings.ts` | 112 · Healing119.id (119 ext. 8) · your campus counselling service | Layanan Psikologis PNJ on WhatsApp (`https://wa.me/6282379574919`), Monday to Friday 08.00–16.00 WIB · BK PNJ |
| `src/screening/content.ts` and `src/i18n/screening-content.ts`, `HIGH_RISK.nextStep` | "…a counsellor at your campus counselling service" | "…a counsellor at the PNJ Counselling Unit (BK PNJ)" |
| `src/i18n/strings.ts`, `landing.eyebrow`, footer | "Academic burnout screening" | "Academic burnout screening at PNJ"; "Politeknik Negeri Jakarta · Student wellbeing support" |
| `index.html` description | "university students" | "PNJ students" |

## Sign-up

`ruang-pulih-db/for-pnj-later/005_signup_domains.sql` limits sign-up to
`@stu.pnj.ac.id` (students) and `@tik.pnj.ac.id` (advisors). It is not used
in the general edition.
