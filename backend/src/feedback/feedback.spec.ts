import { RULE_BASE } from '../screening/rule-engine/rule-base';
import { checkFeedback } from './feedback.checker';
import { toFeedbackContext } from './feedback.context';
import type { FeedbackContext } from './feedback.context';
import { generateFeedback } from './feedback.generator';
import { buildFeedbackMessages, FEEDBACK_SYSTEM_PROMPT } from './feedback.prompt';
import {
  DEFAULT_GROQ_MODEL,
  GROQ_CHAT_URL,
  GROQ_MAX_COMPLETION_TOKENS,
  requestGroqCompletion,
} from './groq.request';

function contextFor(ruleId: string): FeedbackContext {
  const rule = RULE_BASE.find((r) => r.id === ruleId)!;
  return toFeedbackContext({
    rule_id: rule.id,
    category: rule.category,
    workload_level: rule.workload,
    exhaustion_level: rule.exhaustion,
    disengagement_level: rule.disengagement,
    intervention_level: rule.interventionLevel,
  });
}

const HIGH = contextFor('R9'); // High workload, high exhaustion -> High risk
const MODERATE = contextFor('R8');
const NONE = contextFor('R2');

const GOOD_HIGH_NOTE =
  'Your result is High risk. Your answers point to a heavy academic workload together with a lot of exhaustion, which is a tiring combination to carry for weeks. It makes sense that things feel hard right now.\n\n' +
  'The recommended next step is to speak with a counsellor at BK PNJ. You do not need to prepare anything special; describing how the past two weeks have felt is enough to start. Your Academic Advisor can help you arrange a time.';

const GOOD_MODERATE_NOTE =
  'Your result is Moderate risk. Your answers show clear signs of exhaustion even though your workload is at a standard level, so the tiredness you feel is real and worth paying attention to.\n\n' +
  'The recommended next step is a conversation with your Academic Advisor (DPA). Sharing how your energy has been lately can help the two of you look at your schedule and find small adjustments.';

const GOOD_NONE_NOTE =
  'Your result is No burnout. Your answers suggest that your current workload feels manageable and that you still have energy and interest for your studies, which is a good place to be in the middle of a semester.\n\n' +
  'The recommended next step is simply to keep looking after yourself: hold on to the routines for rest and planning that are working, and check in again later in the term to see how things are going.';

describe('Feedback context and prompt', () => {
  it('builds the context from the stored result and the validated rule', () => {
    expect(HIGH).toEqual({
      category: 'HIGH_RISK',
      workloadLevel: 'HIGH',
      exhaustionLevel: 'HIGH',
      disengagementLevel: 'LOW',
      interventionLevel: 'CURATIVE',
      rationale:
        'Student appraises tasks as a threat; coping is overwhelmed, triggering distress and acute exhaustion.',
      recommendation:
        'Go for counselling at the PNJ Counselling Unit (BK PNJ). This is a referral to counselling.',
    });
  });

  it('builds a context for every rule', () => {
    for (const rule of RULE_BASE) {
      const context = contextFor(rule.id);
      expect(context.category).toBe(rule.category);
      expect(context.rationale).toBe(rule.rationale.en);
    }
  });

  it('rejects an unknown rule id', () => {
    expect(() =>
      toFeedbackContext({
        rule_id: 'R99',
        category: 'HIGH_RISK',
        workload_level: 'HIGH',
        exhaustion_level: 'HIGH',
        disengagement_level: 'LOW',
        intervention_level: 'CURATIVE',
      }),
    ).toThrow(/Unknown rule id/);
  });

  it('sends the decision as fixed facts and nothing that identifies the student', () => {
    const [system, user] = buildFeedbackMessages(HIGH);
    expect(system).toEqual({ role: 'system', content: FEEDBACK_SYSTEM_PROMPT });
    expect(user.role).toBe('user');
    expect(user.content).toContain('Screening category (final): High risk');
    expect(user.content).toContain('Academic workload: High');
    expect(user.content).toContain('Exhaustion: High');
    expect(user.content).toContain('Disengagement: Low');
    expect(user.content).toContain(
      'Recommended next step (final, must be kept): Go for counselling at the PNJ Counselling Unit (BK PNJ).',
    );
    // Staff labels are not given to the model, so it cannot copy them.
    expect(user.content).not.toMatch(/promotive|preventive|curative/i);
    // Only the fields of FeedbackContext exist, so there is nothing else to leak.
    expect(Object.keys(HIGH).sort()).toEqual([
      'category',
      'disengagementLevel',
      'exhaustionLevel',
      'interventionLevel',
      'rationale',
      'recommendation',
      'workloadLevel',
    ]);
    expect(user.content).not.toMatch(/\bR9\b/);
    expect(user.content).not.toMatch(/\d+\.\d+/); // no scores
  });
});

describe('Feedback checker', () => {
  it('accepts a note that keeps the category and the action', () => {
    expect(checkFeedback(GOOD_HIGH_NOTE, HIGH)).toEqual({
      ok: true,
      text: GOOD_HIGH_NOTE,
    });
    expect(checkFeedback(GOOD_MODERATE_NOTE, MODERATE).ok).toBe(true);
    expect(checkFeedback(GOOD_NONE_NOTE, NONE).ok).toBe(true);
  });

  it('tidies quotes and extra blank lines', () => {
    const check = checkFeedback(`"${GOOD_HIGH_NOTE.replace('\n\n', '\n\n\n\n')}"  `, HIGH);
    expect(check).toEqual({ ok: true, text: GOOD_HIGH_NOTE });
  });

  it('rejects a note that names a different category', () => {
    const softened = GOOD_HIGH_NOTE.replace('High risk', 'Moderate risk');
    const check = checkFeedback(softened, HIGH);
    expect(check.ok).toBe(false);
    expect(JSON.stringify(check)).toContain('MODERATE_RISK');

    const mixed = GOOD_HIGH_NOTE + ' This is close to low risk.';
    expect(checkFeedback(mixed, HIGH).ok).toBe(false);
    expect(checkFeedback(GOOD_NONE_NOTE + ' You are not high-risk.', NONE).ok).toBe(false);
  });

  it('rejects a note that drops the recommended action', () => {
    const noCounsellor = GOOD_HIGH_NOTE.replace(
      'speak with a counsellor at BK PNJ',
      'take a few days off',
    ).replace('Your Academic Advisor can help you arrange a time.', 'Rest well.');
    expect(checkFeedback(noCounsellor, HIGH)).toEqual({
      ok: false,
      reason: 'recommended action is missing',
    });
    const noAdvisor = GOOD_MODERATE_NOTE.replace(
      'a conversation with your Academic Advisor (DPA)',
      'more sleep',
    );
    expect(checkFeedback(noAdvisor, MODERATE).ok).toBe(false);
  });

  it('rejects clinical language, rule numbers, and AI self-reference', () => {
    expect(
      checkFeedback(GOOD_HIGH_NOTE + ' You may have depression.', HIGH).ok,
    ).toBe(false);
    expect(
      checkFeedback(GOOD_HIGH_NOTE + ' Consider medication.', HIGH).ok,
    ).toBe(false);
    expect(checkFeedback(GOOD_HIGH_NOTE + ' This matched R9.', HIGH).ok).toBe(false);
    expect(
      checkFeedback('As an AI, I think: ' + GOOD_HIGH_NOTE, HIGH).ok,
    ).toBe(false);
  });

  it('rejects the three real notes that exposed these problems', () => {
    // Actual model output from the first live run, kept as regression cases.
    const realNoBurnout =
      'Your recent screening came back with the category No burnout. This reflects that your academic workload is very low and you’ve been feeling low levels of exhaustion and disengagement. It suggests that, at this time, you are managing your studies without overwhelming stress.\n\n' +
      'The recommended next step is Promotive: self-help education. You can take advantage of available guides and workshops on healthy study routines, time‑management tips, and ways to keep a balanced approach to learning. Exploring these resources can help you maintain this positive momentum.';
    const realHighA =
      'Your screening shows a High risk result, reflecting the very high academic workload you’ve been handling and the strong feelings of exhaustion and disengagement you’ve experienced. It’s understandable that such pressures can take a toll.\n\n' +
      'The next step is a Curative: counselling referral to the PNJ Counselling Unit (BK PNJ). Reaching out to the counselling team can give you a supportive space to talk through what’s going on and find practical ways to regain balance. Taking this step is a positive move toward feeling better.';
    const realHighB =
      'Your screening result shows a High risk pattern, reflecting that you are currently handling a high academic workload and experiencing high levels of exhaustion and disengagement.\n\n' +
      'The recommended next step is a counselling referral to the PNJ Counselling Unit (BK PNJ). Reaching out to this unit will give you a supportive space to discuss how you’re feeling and explore practical ways to manage your workload and wellbeing. You can contact them by phone or visit their office to set up an appointment. Taking this step can help you move toward a more balanced experience.';

    expect(checkFeedback(realNoBurnout, contextFor('R1'))).toEqual({
      ok: false,
      reason: 'uses the staff label "Promotive"',
    });
    expect(checkFeedback(realHighA, contextFor('R20'))).toEqual({
      ok: false,
      reason: 'uses the staff label "Curative"',
    });
    // Same note with the label already removed: the invented contact method
    // is still caught.
    expect(checkFeedback(realHighB, contextFor('R19'))).toEqual({
      ok: false,
      reason: 'mentions "phone", which was not provided',
    });
    expect(
      checkFeedback(GOOD_NONE_NOTE + ' There are workshops for this.', NONE).ok,
    ).toBe(false);
  });

  it('rejects empty, too short, and too long replies', () => {
    expect(checkFeedback('', HIGH)).toEqual({ ok: false, reason: 'empty reply' });
    expect(checkFeedback('   ', HIGH).ok).toBe(false);
    expect(checkFeedback('Talk to a counsellor at BK PNJ.', HIGH).ok).toBe(false);
    expect(checkFeedback((GOOD_HIGH_NOTE + ' ').repeat(3), HIGH).ok).toBe(false);
    expect(checkFeedback(undefined as unknown as string, HIGH).ok).toBe(false);
  });
});

describe('Feedback generator', () => {
  it('returns the note when the first reply passes', async () => {
    let calls = 0;
    const note = await generateFeedback(HIGH, async () => {
      calls += 1;
      return GOOD_HIGH_NOTE;
    });
    expect(note).toBe(GOOD_HIGH_NOTE);
    expect(calls).toBe(1);
  });

  it('retries once when the first reply is rejected', async () => {
    const replies = [GOOD_HIGH_NOTE.replace('High risk', 'Low risk'), GOOD_HIGH_NOTE];
    const rejected: string[] = [];
    const note = await generateFeedback(
      HIGH,
      async () => replies.shift()!,
      (reason, attempt) => rejected.push(`${attempt}: ${reason}`),
    );
    expect(note).toBe(GOOD_HIGH_NOTE);
    expect(rejected).toEqual(['1: mentions another category (LOW_RISK)']);
  });

  it('gives up with null after two rejected replies', async () => {
    let calls = 0;
    const note = await generateFeedback(HIGH, async () => {
      calls += 1;
      return 'You are fine.';
    });
    expect(note).toBe(null);
    expect(calls).toBe(2);
  });

  it('lets request errors reach the caller', async () => {
    let message = '';
    try {
      await generateFeedback(HIGH, async () => {
        throw new Error('quota exceeded');
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe('quota exceeded');
  });
});

describe('Groq request', () => {
  const messages = buildFeedbackMessages(HIGH);

  function fakeFetch(status: number, body: unknown) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const impl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
      });
    }) as unknown as typeof fetch;
    return { impl, calls };
  }

  it('posts the messages to the chat completions endpoint and returns the text', async () => {
    const { impl, calls } = fakeFetch(200, {
      choices: [{ message: { role: 'assistant', content: GOOD_HIGH_NOTE } }],
    });
    const text = await requestGroqCompletion({
      apiKey: 'test-key',
      model: DEFAULT_GROQ_MODEL,
      messages,
      fetchImpl: impl,
    });
    expect(text).toBe(GOOD_HIGH_NOTE);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(GROQ_CHAT_URL);
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-key',
    });
    const sent = JSON.parse(calls[0].init.body as string);
    expect(sent.model).toBe('openai/gpt-oss-120b');
    expect(sent.messages).toEqual(messages);
    expect(sent.max_completion_tokens).toBe(GROQ_MAX_COMPLETION_TOKENS);
    // Not sent unless asked for, so models without reasoning are unaffected.
    expect('reasoning_effort' in sent).toBe(false);
  });

  it('sends reasoning_effort only when it is set', async () => {
    const { impl, calls } = fakeFetch(200, {
      choices: [{ message: { content: GOOD_HIGH_NOTE } }],
    });
    await requestGroqCompletion({
      apiKey: 'k',
      model: DEFAULT_GROQ_MODEL,
      messages,
      reasoningEffort: 'low',
      fetchImpl: impl,
    });
    expect(JSON.parse(calls[0].init.body as string).reasoning_effort).toBe('low');
  });

  it('reads the answer from content and ignores a separate reasoning field', async () => {
    const { impl } = fakeFetch(200, {
      choices: [
        {
          message: {
            role: 'assistant',
            content: GOOD_HIGH_NOTE,
            reasoning: 'The student is High risk, so I should...',
          },
          finish_reason: 'stop',
        },
      ],
    });
    const text = await requestGroqCompletion({ apiKey: 'k', model: 'm', messages, fetchImpl: impl });
    expect(text).toBe(GOOD_HIGH_NOTE);
  });

  it('explains when the token budget ran out before any answer', async () => {
    const { impl } = fakeFetch(200, {
      choices: [{ message: { content: '', reasoning: 'thinking...' }, finish_reason: 'length' }],
    });
    let message = '';
    try {
      await requestGroqCompletion({ apiKey: 'k', model: 'm', messages, fetchImpl: impl });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('ran out of tokens');
  });

  it('throws on an error status without leaking the key', async () => {
    const { impl } = fakeFetch(429, '{"error":{"message":"Rate limit reached"}}');
    let message = '';
    try {
      await requestGroqCompletion({ apiKey: 'secret-key', model: 'm', messages, fetchImpl: impl });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('status 429');
    expect(message).toContain('Rate limit reached');
    expect(message).not.toContain('secret-key');
  });

  it('throws when the response has no text', async () => {
    const { impl } = fakeFetch(200, { choices: [] });
    let message = '';
    try {
      await requestGroqCompletion({ apiKey: 'k', model: 'm', messages, fetchImpl: impl });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe('Groq response did not contain any text.');
  });
});
