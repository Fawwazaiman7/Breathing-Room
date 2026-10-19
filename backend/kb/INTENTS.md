# Support Chat intents

The Support Chat recognises six intents. Each example question and each
knowledge base passage belongs to exactly one of them.

| Intent | A question belongs here when it is about |
|---|---|
| `BURNOUT_INFO` | Burnout as a subject: what it is, its signs, causes and consequences, who is affected, how it differs from stress, tiredness or laziness. |
| `WORKLOAD` | How heavy the study demands are or feel: too many or too difficult tasks, pressure, frustration with the work itself. Also the NASA-TLX questionnaire, its six dimensions and the workload score. |
| `EXHAUSTION_DISENGAGEMENT` | Feeling drained, or feeling distant from and uninterested in one's studies, and how to cope with those feelings. Also the OLBI questionnaire and the exhaustion and disengagement scores. |
| `TIME_MANAGEMENT` | Organising time: planning, scheduling, priorities, deadlines, procrastination, breaks, and time lost in group work or other activities. |
| `SCREENING_RESULT` | The final screening category (No burnout, Low, Moderate or High risk): what it means, how it is decided, whether it is a diagnosis, how accurate it is, whether it can change, retaking the screening. |
| `STUDENT_SUPPORT` | People and services: the Academic Advisor, the counselling service (registration, place, hours, cost, what a session is like), confidentiality and who can see a student's data, where to turn for urgent help, and how to help someone else. |

## Rules for questions that touch two intents

These follow the labels already given to the 30 utterances of the thesis
dataset, so the training examples and the test set use one convention.

1. **A questionnaire dimension or its score belongs to the intent of that
   instrument, not to `SCREENING_RESULT`.** NASA-TLX dimensions and the
   workload score are `WORKLOAD`; exhaustion and disengagement scores are
   `EXHAUSTION_DISENGAGEMENT`. `SCREENING_RESULT` is only about the final
   category.
2. **Who can see a result, and anything else about privacy or about the
   Academic Advisor, is `STUDENT_SUPPORT`**, even when the word "result"
   appears.
3. **A question that names two topics belongs to the one it asks about.**
   "Does time management prevent burnout?" asks about time management, so it
   is `TIME_MANAGEMENT`. "My projects are piling up" describes how heavy the
   work is, so it is `WORKLOAD`; "How do I divide my time between projects?"
   asks how to organise time, so it is `TIME_MANAGEMENT`.
4. **Helping another person is `STUDENT_SUPPORT`**, whatever that person is
   going through.

## How an intent is decided

1. **Keyword rules first.** A few cases are certain whatever other words the
   question contains, so they are decided by rule
   (`src/chat/chat.intent-rules.ts`). The rules are checked in this order and
   the first match wins:

   | Rule | Intent | Applies when the question |
   |---|---|---|
   | `SS-ADVISOR` | `STUDENT_SUPPORT` | mentions the Academic Advisor (DPA, dosen PA, dosen pembimbing akademik, advisor) |
   | `SS-COUNSELLING` | `STUDENT_SUPPORT` | mentions counselling, a counsellor, or the psychological service |
   | `SS-PRIVACY` | `STUDENT_SUPPORT` | asks who can see something, or about privacy, confidentiality or the student's own data |
   | `SS-SOMEONE-ELSE` | `STUDENT_SUPPORT` | is about a friend or classmate and expresses concern for them or asks how to help |
   | `SR-CATEGORY` | `SCREENING_RESULT` | names the screening result, or a result together with one of the four categories |
   | `WL-INSTRUMENT` | `WORKLOAD` | names NASA-TLX, one of its dimensions, or the workload score |
   | `ED-INSTRUMENT` | `EXHAUSTION_DISENGAGEMENT` | names OLBI, or the exhaustion or disengagement score |
   | `TM-NAMED` | `TIME_MANAGEMENT` | names managing, dividing or organising time |
   | `ED-STATE` | `EXHAUSTION_DISENGAGEMENT` | says the student is tired, or names exhaustion or disengagement, without also naming burnout or time management |
   | `WL-QUANTITY` | `WORKLOAD` | says that study work (assignments, projects, deadlines) is too much, piling up or clashing |

   The order encodes the rules of the previous section: people and services
   come before the result, and the result before the questionnaires. The
   last three rules follow what the question itself is about: a question
   that names time management is about time management even when it also
   mentions burnout or a pile of tasks, and a question about work that is
   piling up is about the workload even though managing time may be part of
   the answer.

   `ED-STATE` follows the distinction the campus psychologist draws: workload
   is seen in what a student has to do, while exhaustion and disengagement
   are states the student feels and puts into words ("I am exhausted").
2. **Otherwise the vote.** The five closest neighbours among the training
   examples and the knowledge base passages vote, each with a weight equal to
   its similarity to the question.

No language model takes part, so the same question always gets the same
intent.

The keyword rules were added on 12 October 2026, after the first evaluation
runs and with the missed test questions in view. By then every question the
vote had missed had been looked at one by one, so the 30 utterances served
as development data for the rules, not as an unseen test.

The rules and the training examples were frozen on 12 October 2026 with ten
rules. How the chatbot does on new questions is measured on a separate
hold-out set, `intent-holdout-set.json`, written after that date by someone
who had not seen the rules, and classified once without further changes. The evaluation therefore
also reports the figure for the vote alone, and the rules should be checked
again on questions collected later, for example during user testing.

## Questions that belong to two intents

Some questions sit between two intents whichever rule is used: "Does time
management prevent burnout?" is about both. In the test set such a question
keeps its original label in `intent` and gets a second one in `secondary`,
with the reason in `secondaryReason`. The second labels were assigned by the
dataset author on 12 October 2026, after the first evaluation runs. For that
reason the evaluation always reports two figures:

- **strict accuracy**: the prediction equals the original label;
- **relaxed accuracy**: the prediction equals the original label or the
  second label.

Questions about the Academic Advisor keep a single label
(`STUDENT_SUPPORT`), so a different prediction for them is an error under
both figures.

On 15 October 2026 the result labels shown in the app gained the word
"burnout" (for example "High burnout risk"). The `SR-CATEGORY` pattern was
widened to also match these labels. No question in the three data files
contains such a label, so every figure reported here is unchanged.

On 19 October 2026 the app became a general edition for the final-project
presentation (no campus named). The PNJ-specific passages SS-04 to SS-13 and
SS-16 were replaced by general ones; the PNJ knowledge base is kept in
`for-pnj-later/knowledge-base-pnj.json`. Passages take part in the vote, so
the evaluation must be run again after `node kb/index-kb.mjs`; the figures
above are from the PNJ knowledge base. The keyword rules and the three data
files did not change. The reply prompt now asks for one short answer
sentence and 2 to 4 key points, at most 80 words; this changes the wording
of replies, not the intent decision.

## The data files

| File | Rows | Role |
|---|---|---|
| `intent-examples.json` | 60 (T01 to T60), ten per intent, half English and half Indonesian | Training examples. Loaded into the database; they vote together with the knowledge base passages. |
| `intent-test-set.json` | 30 (U01 to U30), five per intent | The original thesis dataset with its original labels. Never loaded into the database. Used to refine the rules, so it is development data. |
| `intent-holdout-set.json` | to be added | Hold-out set: new questions, never loaded into the database, classified once after the rules were frozen. |

The dataset author reviewed the 60 training examples on 12 October 2026.
All were approved except T19, which was shortened from "Deadline minggu ini
banyak sekali, saya kewalahan." to "Deadline minggu ini banyak sekali.": the
second half voiced a state, so the sentence did not describe the workload
alone. The change came from that review, not from a miss in the hold-out
set, and the evaluation was run again afterwards.

Both files are synthetic: the questions were written for the project, not
collected from students. `node kb/evaluate-chat.mjs` classifies every test
question with the training examples and passages only, and leaves out any
training example that is nearly the same sentence as the test question
being classified (cosine similarity of 0.88 or more).
