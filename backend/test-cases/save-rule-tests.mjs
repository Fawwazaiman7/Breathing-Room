#!/usr/bin/env node
/**
 * Saves every case in rule-base-cases.json to the database through the
 * RUNNING backend (POST /screening), then reads them back
 * (GET /screening/mine) and checks that what was stored matches what was
 * expected.
 *
 * Usage, from the backend folder, with `npm run start:dev` running:
 *   node test-cases/save-rule-tests.mjs <access_token>
 *   node test-cases/save-rule-tests.mjs <access_token> http://localhost:3000
 *
 * <access_token> is the access token of a STUDENT test account, the same
 * one you paste after "Bearer " in Thunder Client. It expires after about
 * an hour; request a new one if you get a 401.
 *
 * This adds one row per case (34 rows) to public.screenings for that
 * student. The script prints an SQL statement that removes exactly those
 * rows again. Use a test account, not a real student's.
 *
 * Results are also written to test-cases/rule-save-results.csv.
 * Exit code is 0 when every case passes, 1 otherwise.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const token = (process.argv[2] ?? '').replace(/^Bearer\s+/i, '');
const baseUrl = (process.argv[3] ?? 'http://localhost:3000').replace(/\/$/, '');

if (!token) {
  console.error('Missing access token.');
  console.error('Usage: node test-cases/save-rule-tests.mjs <access_token>');
  process.exit(1);
}

const file = JSON.parse(
  readFileSync(join(here, 'rule-base-cases.json'), 'utf8'),
);
const cases = [...file.ruleCases, ...file.boundaryCases];
const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
};

async function call(method, path, body) {
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    console.error(
      `Could not reach ${baseUrl}. Is the backend running (npm run start:dev)?`,
    );
    console.error(String(error?.cause ?? error));
    process.exit(1);
  }
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    console.error('The backend rejected the access token (401).');
    console.error('It may have expired. Sign in again to get a new one.');
    process.exit(1);
  }
  if (response.status === 403) {
    console.error('This account may not submit screenings (403).');
    console.error('Use the access token of a STUDENT account.');
    process.exit(1);
  }
  return { ok: response.ok, status: response.status, data };
}

/** Fields under test, taken from the POST /screening response. */
function fromSubmit(body) {
  return {
    nasaWeightedWorkload: body.nasaTlx?.weightedWorkload,
    nasaScore: body.nasaTlx?.score,
    workloadLevel: body.nasaTlx?.level,
    exhaustionScore: body.olbi?.exhaustion?.score,
    exhaustionLevel: body.olbi?.exhaustion?.level,
    disengagementScore: body.olbi?.disengagement?.score,
    disengagementLevel: body.olbi?.disengagement?.level,
    ruleId: body.ruleId,
    category: body.category,
    recommendation: body.recommendation?.id,
  };
}

/** The same fields as stored in the database (GET /screening/mine item). */
function fromStored(item) {
  return {
    nasaScore: item.workload?.score,
    workloadLevel: item.workload?.level,
    exhaustionScore: item.exhaustion?.score,
    exhaustionLevel: item.exhaustion?.level,
    disengagementScore: item.disengagement?.score,
    disengagementLevel: item.disengagement?.level,
    ruleId: item.ruleId,
    category: item.category,
    recommendation: item.recommendation?.id,
  };
}

function diff(expected, actual, keys) {
  return keys
    .filter((key) => actual[key] !== expected[key])
    .map((key) => `${key}: expected ${expected[key]}, got ${actual[key]}`);
}

// ---- 1. Save every case ----
const before = await call('GET', '/screening/mine');
const countBefore = Array.isArray(before.data) ? before.data.length : 0;

const rows = [];
for (const testCase of cases) {
  const { ok, status, data } = await call('POST', '/screening', testCase.input);
  const row = { testCase, id: null, problems: [], stored: {} };
  if (!ok) {
    row.problems.push(`HTTP ${status}: ${JSON.stringify(data.message ?? data)}`);
  } else {
    row.id = data.id ?? null;
    if (!row.id) {
      row.problems.push('response has no id, so the row was not saved');
    }
    row.problems.push(
      ...diff(testCase.expected, fromSubmit(data), Object.keys(testCase.expected)),
    );
  }
  rows.push(row);
}

// ---- 2. Read back from the database and compare ----
const after = await call('GET', '/screening/mine');
const storedById = new Map(
  (Array.isArray(after.data) ? after.data : []).map((item) => [item.id, item]),
);
for (const row of rows) {
  if (!row.id) continue;
  const item = storedById.get(row.id);
  if (!item) {
    row.problems.push('saved id was not found when reading back');
    continue;
  }
  row.stored = fromStored(item);
  row.problems.push(
    ...diff(row.testCase.expected, row.stored, Object.keys(row.stored)).map(
      (text) => `stored ${text}`,
    ),
  );
}

// ---- Console report ----
const pad = (value, width) => String(value ?? '-').padEnd(width);
console.log(`\nSave-and-read-back run against ${baseUrl}\n`);
console.log(
  pad('Case', 8) + pad('Expected', 20) + pad('Stored in database', 20) +
    pad('Row id', 38) + 'Result',
);
console.log('-'.repeat(92));
for (const row of rows) {
  const e = row.testCase.expected;
  console.log(
    pad(row.testCase.id, 8) +
      pad(`${e.ruleId} ${e.category}`, 20) +
      pad(`${row.stored.ruleId ?? '-'} ${row.stored.category ?? ''}`, 20) +
      pad(row.id, 38) +
      (row.problems.length === 0 ? 'PASS' : 'FAIL'),
  );
}

const failed = rows.filter((row) => row.problems.length > 0);
if (failed.length > 0) {
  console.log('\nFailures:');
  for (const row of failed) {
    console.log(`  ${row.testCase.id}: ${row.problems.join('; ')}`);
  }
}

const savedIds = rows.map((row) => row.id).filter(Boolean);
const countAfter = storedById.size;
console.log(
  `\n${rows.length - failed.length} of ${rows.length} passed` +
    (failed.length > 0 ? `, ${failed.length} FAILED` : ''),
);
console.log(
  `Rows for this student: ${countBefore} before, ${countAfter} after ` +
    `(${savedIds.length} saved by this run).`,
);

// ---- CSV report ----
const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const header = [
  'Case', 'Description', 'Expected rule', 'Expected category',
  'Stored rule', 'Stored category', 'Stored NASA-TLX score',
  'Stored exhaustion score', 'Stored disengagement score',
  'Stored recommendation', 'Row id', 'Result',
];
const lines = rows.map((row) => {
  const e = row.testCase.expected;
  return [
    row.testCase.id, row.testCase.title, e.ruleId, e.category,
    row.stored.ruleId, row.stored.category, row.stored.nasaScore,
    row.stored.exhaustionScore, row.stored.disengagementScore,
    row.stored.recommendation, row.id,
    row.problems.length === 0 ? 'PASS' : 'FAIL',
  ].map(quote).join(',');
});
const csvPath = join(here, 'rule-save-results.csv');
// The leading BOM makes Excel read the file as UTF-8.
writeFileSync(csvPath, '﻿' + [header.map(quote).join(','), ...lines].join('\r\n') + '\r\n');
console.log(`Results written to ${csvPath}`);

// ---- Clean-up help ----
if (savedIds.length > 0) {
  console.log('\nTo remove the rows saved by this run, run this in the Supabase SQL Editor:\n');
  console.log(
    `delete from public.screenings where id in (\n${savedIds
      .map((id) => `  '${id}'`)
      .join(',\n')}\n);`,
  );
}

process.exit(failed.length > 0 ? 1 : 0);
