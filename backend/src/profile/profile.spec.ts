import {
  buildProfilePatch,
  ProfileError,
  updateMyProfile,
} from './profile.logic.js';
import type {
  ProfileRow,
  ProfileStore,
  ProfileUser,
} from './profile.logic.js';

const STUDENT: ProfileUser = { id: 's1', role: 'student' };
const ADVISOR: ProfileUser = { id: 'a1', role: 'advisor' };

interface StoredRow extends ProfileRow {
  advisor_id: string | null;
  invite_code: string | null;
}

function seed(): StoredRow[] {
  return [
    { id: 's1', role: 'student', full_name: 'Alya Rahman', student_number: '2307413011', class_name: 'TI 6A', advisor_id: 'a1', invite_code: null },
    { id: 's2', role: 'student', full_name: 'Rizky Fauzan', student_number: '2307413022', class_name: 'TI 6B', advisor_id: null, invite_code: null },
    { id: 'a1', role: 'advisor', full_name: 'Dr. Budi Santoso', student_number: null, class_name: null, advisor_id: null, invite_code: 'AB2C-9KMP' },
  ];
}

/** In-memory stand-in for the profiles table, including the unique NIM rule. */
function memoryStore(rows: StoredRow[]): ProfileStore & { writes: object[] } {
  const writes: object[] = [];
  return {
    writes,
    updateProfile: async (user, patch) => {
      writes.push(patch);
      const row = rows.find((r) => r.id === user.id && r.role === user.role);
      if (!row) {
        return null;
      }
      if (
        patch.student_number !== undefined &&
        rows.some((r) => r.id !== row.id && r.student_number === patch.student_number)
      ) {
        return 'student_number_taken';
      }
      Object.assign(row, patch);
      return { ...row };
    },
  };
}

async function failure(work: Promise<unknown>): Promise<ProfileError> {
  try {
    await work;
  } catch (error) {
    if (error instanceof ProfileError) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected a ProfileError.');
}

describe('Profile editing', () => {
  it('saves a student name, student number and class', async () => {
    const rows = seed();
    const view = await updateMyProfile(memoryStore(rows), STUDENT, {
      fullName: 'Alya R. Putri',
      studentNumber: '2307413099',
      className: 'TI 7A',
    });
    expect(view).toEqual({
      id: 's1',
      role: 'student',
      fullName: 'Alya R. Putri',
      studentNumber: '2307413099',
      className: 'TI 7A',
    });
    expect(rows[0].full_name).toBe('Alya R. Putri');
    expect(rows[0].student_number).toBe('2307413099');
    expect(rows[0].class_name).toBe('TI 7A');
  });

  it('tidies spaces in the name and class', () => {
    expect(
      buildProfilePatch('student', {
        fullName: '  Alya   Rahman ',
        studentNumber: ' 2307413011 ',
        className: ' TI   6A ',
      }),
    ).toEqual({
      full_name: 'Alya Rahman',
      student_number: '2307413011',
      class_name: 'TI 6A',
    });
  });

  it('lets a student keep their own student number', async () => {
    const view = await updateMyProfile(memoryStore(seed()), STUDENT, {
      fullName: 'Alya Rahman Putri',
      studentNumber: '2307413011',
      className: 'TI 6A',
    });
    expect(view.fullName).toBe('Alya Rahman Putri');
    expect(view.studentNumber).toBe('2307413011');
  });

  it('refuses a student number that another account already uses', async () => {
    const rows = seed();
    const error = await failure(
      updateMyProfile(memoryStore(rows), STUDENT, {
        fullName: 'Alya Rahman',
        studentNumber: '2307413022',
        className: 'TI 6A',
      }),
    );
    expect(error.kind).toBe('STUDENT_NUMBER_TAKEN');
    expect(rows[0].student_number).toBe('2307413011');
  });

  it('rejects a missing or over-long name', () => {
    for (const fullName of ['', '   ', undefined, 42, 'x'.repeat(121)]) {
      expect(() =>
        buildProfilePatch('advisor', { fullName }),
      ).toThrow(ProfileError);
    }
    expect(buildProfilePatch('advisor', { fullName: 'x'.repeat(120) })).toEqual({
      full_name: 'x'.repeat(120),
    });
  });

  it('rejects a student number that is not 5 to 20 digits', () => {
    for (const studentNumber of ['', '1234', '23074A3011', '2307 413011', '1'.repeat(21), undefined, 2307413011]) {
      expect(() =>
        buildProfilePatch('student', {
          fullName: 'Alya Rahman',
          studentNumber,
          className: 'TI 6A',
        }),
      ).toThrow(ProfileError);
    }
  });

  it('rejects a missing or over-long class for a student', () => {
    for (const className of ['', '  ', undefined, 'x'.repeat(31)]) {
      expect(() =>
        buildProfilePatch('student', {
          fullName: 'Alya Rahman',
          studentNumber: '2307413011',
          className,
        }),
      ).toThrow(ProfileError);
    }
  });

  it('does not write anything when the input is invalid', async () => {
    const store = memoryStore(seed());
    const error = await failure(
      updateMyProfile(store, STUDENT, { fullName: '', studentNumber: '2307413011', className: 'TI 6A' }),
    );
    expect(error.kind).toBe('INVALID');
    expect(store.writes).toHaveLength(0);
  });

  it('changes only the name for an Academic Advisor', async () => {
    const rows = seed();
    const store = memoryStore(rows);
    const view = await updateMyProfile(store, ADVISOR, {
      fullName: 'Dr. Budi Santoso, M.Kom.',
      studentNumber: '9999999999',
      className: 'TI 6A',
    });
    expect(view).toEqual({
      id: 'a1',
      role: 'advisor',
      fullName: 'Dr. Budi Santoso, M.Kom.',
      studentNumber: null,
      className: null,
    });
    expect(store.writes).toEqual([{ full_name: 'Dr. Budi Santoso, M.Kom.' }]);
  });

  it('never writes the role, the advisor link or the invite code', async () => {
    const rows = seed();
    const store = memoryStore(rows);
    // Extra properties a tampered request might carry.
    const tampered = {
      fullName: 'Alya Rahman',
      studentNumber: '2307413011',
      className: 'TI 6A',
      role: 'advisor',
      advisor_id: 'someone-else',
      advisorId: 'someone-else',
      invite_code: 'HACK-CODE',
      id: 's2',
    };
    await updateMyProfile(store, STUDENT, tampered);
    expect(Object.keys(store.writes[0]).sort()).toEqual([
      'class_name',
      'full_name',
      'student_number',
    ]);
    expect(rows[0].role).toBe('student');
    expect(rows[0].advisor_id).toBe('a1');
    expect(rows[0].invite_code).toBeNull();
    // The other student's row is untouched.
    expect(rows[1].full_name).toBe('Rizky Fauzan');
  });

  it('reports a missing profile', async () => {
    const error = await failure(
      updateMyProfile(memoryStore(seed()), { id: 'ghost', role: 'student' }, {
        fullName: 'Nobody',
        studentNumber: '2307413000',
        className: 'TI 6A',
      }),
    );
    expect(error.kind).toBe('NOT_FOUND');
  });
});
