import {
  generateInviteCode,
  INVITE_CODE_ALPHABET,
  normalizeInviteCode,
} from './advising.code.js';
import {
  AdvisingError,
  getInviteCode,
  getMyAdvisor,
  joinAdvisor,
  previewAdvisor,
  regenerateInviteCode,
  removeStudent,
} from './advising.logic.js';
import type {
  AdvisingProfile,
  AdvisingStore,
  AdvisingUser,
} from './advising.logic.js';

/** In-memory stand-in for the profiles table. */
function memoryStore(profiles: AdvisingProfile[]): AdvisingStore {
  const find = (id: string) => profiles.find((p) => p.id === id) ?? null;
  return {
    getProfile: async (id) => find(id),
    findAdvisorByCode: async (code) =>
      profiles.find((p) => p.invite_code === code && p.role === 'advisor') ?? null,
    setAdvisor: async (studentId, advisorId) => {
      const student = find(studentId);
      if (student && student.role === 'student') {
        student.advisor_id = advisorId;
      }
    },
    setInviteCode: async (advisorId, code) => {
      if (profiles.some((p) => p.invite_code === code && p.id !== advisorId)) {
        return 'taken';
      }
      const advisor = find(advisorId);
      if (advisor && advisor.role === 'advisor') {
        advisor.invite_code = code;
      }
      return 'ok';
    },
    unlinkStudent: async (advisorId, studentId) => {
      const student = find(studentId);
      if (!student || student.role !== 'student' || student.advisor_id !== advisorId) {
        return false;
      }
      student.advisor_id = null;
      return true;
    },
  };
}

function setup() {
  const profiles: AdvisingProfile[] = [
    { id: 'adv-1', role: 'advisor', full_name: 'Dr. Budi Santoso', advisor_id: null, invite_code: 'AB2C-9KMP' },
    { id: 'adv-2', role: 'advisor', full_name: 'Dr. Sari Wulandari', advisor_id: null, invite_code: null },
    { id: 'stu-1', role: 'student', full_name: 'Alya Rahman', advisor_id: null, invite_code: null },
    { id: 'stu-2', role: 'student', full_name: 'Bima Saputra', advisor_id: 'adv-1', invite_code: null },
  ];
  return { profiles, store: memoryStore(profiles) };
}

const student1: AdvisingUser = { id: 'stu-1', role: 'student' };
const student2: AdvisingUser = { id: 'stu-2', role: 'student' };
const advisor1: AdvisingUser = { id: 'adv-1', role: 'advisor' };
const advisor2: AdvisingUser = { id: 'adv-2', role: 'advisor' };

/** A predictable "random" source: returns the given numbers in turn. */
function sequence(values: number[]): (max: number) => number {
  let index = 0;
  return (max) => values[index++ % values.length] % max;
}

async function kindOf(work: Promise<unknown>): Promise<string> {
  try {
    await work;
    return 'no error';
  } catch (error) {
    return error instanceof AdvisingError ? error.kind : `other: ${String(error)}`;
  }
}

describe('Invite codes', () => {
  it('generates XXXX-XXXX from the unambiguous alphabet', () => {
    expect(generateInviteCode(sequence([0, 1, 2, 3, 4, 5, 6, 7]))).toBe('ABCD-EFGH');
    expect(generateInviteCode(sequence([30]))).toBe('9999-9999');
    for (const lookAlike of ['I', 'L', 'O', '0', '1']) {
      expect(INVITE_CODE_ALPHABET.includes(lookAlike)).toBe(false);
    }
    expect(INVITE_CODE_ALPHABET.length).toBe(31);
  });

  it('normalizes what a student types', () => {
    expect(normalizeInviteCode('ab2c9kmp')).toBe('AB2C-9KMP');
    expect(normalizeInviteCode('  ab2c - 9kmp ')).toBe('AB2C-9KMP');
    expect(normalizeInviteCode('AB2C-9KMP')).toBe('AB2C-9KMP');
  });

  it('rejects anything that cannot be a code', () => {
    for (const bad of ['', 'AB2C', 'AB2C-9KMPX', 'AB2C-9KM0', 'AB2C-9KMI', 'AB2C_9KMP', null, 12345678]) {
      expect(normalizeInviteCode(bad)).toBe(null);
    }
  });
});

describe('Linking: student side', () => {
  it('reports no advisor before linking, and the advisor after', async () => {
    const { store } = setup();
    expect(await getMyAdvisor(store, student1)).toBe(null);
    expect(await getMyAdvisor(store, student2)).toEqual({ id: 'adv-1', fullName: 'Dr. Budi Santoso' });
  });

  it('previews the advisor name without linking', async () => {
    const { store, profiles } = setup();
    expect(await previewAdvisor(store, student1, 'ab2c 9kmp')).toEqual({ id: 'adv-1', fullName: 'Dr. Budi Santoso' });
    expect(profiles.find((p) => p.id === 'stu-1')!.advisor_id).toBe(null);
  });

  it('links the student who enters a valid code', async () => {
    const { store, profiles } = setup();
    expect(await joinAdvisor(store, student1, 'AB2C-9KMP')).toEqual({ id: 'adv-1', fullName: 'Dr. Budi Santoso' });
    expect(profiles.find((p) => p.id === 'stu-1')!.advisor_id).toBe('adv-1');
    expect(await getMyAdvisor(store, student1)).toEqual({ id: 'adv-1', fullName: 'Dr. Budi Santoso' });
  });

  it('lets a student move to another advisor with that advisor’s code', async () => {
    const { store, profiles } = setup();
    const code = await getInviteCode(store, advisor2, sequence([5, 6, 7, 8, 9, 10, 11, 12]));
    await joinAdvisor(store, student2, code);
    expect(profiles.find((p) => p.id === 'stu-2')!.advisor_id).toBe('adv-2');
  });

  it('rejects malformed and unknown codes, and links nothing', async () => {
    const { store, profiles } = setup();
    expect(await kindOf(joinAdvisor(store, student1, 'hello'))).toBe('INVALID_CODE');
    expect(await kindOf(joinAdvisor(store, student1, 'ZZZZ-ZZZZ'))).toBe('CODE_NOT_FOUND');
    expect(await kindOf(previewAdvisor(store, student1, 'ZZZZ-ZZZZ'))).toBe('CODE_NOT_FOUND');
    expect(profiles.find((p) => p.id === 'stu-1')!.advisor_id).toBe(null);
  });

  it('does not let an advisor use the student endpoints', async () => {
    const { store } = setup();
    expect(await kindOf(joinAdvisor(store, advisor2, 'AB2C-9KMP'))).toBe('FORBIDDEN_ROLE');
    expect(await kindOf(previewAdvisor(store, advisor2, 'AB2C-9KMP'))).toBe('FORBIDDEN_ROLE');
    expect(await kindOf(getMyAdvisor(store, advisor2))).toBe('FORBIDDEN_ROLE');
  });
});

describe('Linking: advisor side', () => {
  it('returns the existing code, or creates one on first use', async () => {
    const { store, profiles } = setup();
    expect(await getInviteCode(store, advisor1, sequence([0]))).toBe('AB2C-9KMP');
    const created = await getInviteCode(store, advisor2, sequence([5, 6, 7, 8, 9, 10, 11, 12]));
    expect(created).toBe('FGHJ-KMNP');
    expect(profiles.find((p) => p.id === 'adv-2')!.invite_code).toBe('FGHJ-KMNP');
    expect(await getInviteCode(store, advisor2, sequence([0]))).toBe('FGHJ-KMNP');
  });

  it('regenerating replaces the code: the old one stops working, links stay', async () => {
    const { store, profiles } = setup();
    const fresh = await regenerateInviteCode(store, advisor1, sequence([20, 21, 22, 23, 24, 25, 26, 27]));
    expect(fresh).toBe('XYZ2-3456');
    expect(await kindOf(joinAdvisor(store, student1, 'AB2C-9KMP'))).toBe('CODE_NOT_FOUND');
    expect(profiles.find((p) => p.id === 'stu-2')!.advisor_id).toBe('adv-1');
    expect(await joinAdvisor(store, student1, fresh)).toEqual({ id: 'adv-1', fullName: 'Dr. Budi Santoso' });
  });

  it('tries again when a generated code is already taken', async () => {
    const { store } = setup();
    // First 8 picks spell AB2C-9KMP (taken by adv-1); the next 8 are free.
    const taken = [...'AB2C9KMP'].map((c) => INVITE_CODE_ALPHABET.indexOf(c));
    const code = await getInviteCode(store, advisor2, sequence([...taken, 1, 1, 1, 1, 1, 1, 1, 1]));
    expect(code).toBe('BBBB-BBBB');
  });

  it('gives up cleanly if no free code can be found', async () => {
    const { store } = setup();
    const taken = [...'AB2C9KMP'].map((c) => INVITE_CODE_ALPHABET.indexOf(c));
    expect(await kindOf(getInviteCode(store, advisor2, sequence(taken)))).toBe('CODE_UNAVAILABLE');
  });

  it('removes only the advisor’s own students', async () => {
    const { store, profiles } = setup();
    expect(await kindOf(removeStudent(store, advisor2, 'stu-2'))).toBe('NOT_FOUND');
    expect(profiles.find((p) => p.id === 'stu-2')!.advisor_id).toBe('adv-1');
    await removeStudent(store, advisor1, 'stu-2');
    expect(profiles.find((p) => p.id === 'stu-2')!.advisor_id).toBe(null);
    expect(await kindOf(removeStudent(store, advisor1, 'stu-2'))).toBe('NOT_FOUND');
    expect(await kindOf(removeStudent(store, advisor1, 'nobody'))).toBe('NOT_FOUND');
  });

  it('does not let a student use the advisor endpoints', async () => {
    const { store } = setup();
    expect(await kindOf(getInviteCode(store, student1, sequence([0])))).toBe('FORBIDDEN_ROLE');
    expect(await kindOf(regenerateInviteCode(store, student1, sequence([0])))).toBe('FORBIDDEN_ROLE');
    expect(await kindOf(removeStudent(store, student1, 'stu-2'))).toBe('FORBIDDEN_ROLE');
  });
});
