#!/usr/bin/env node
/**
 * Runs every case in rule-base-cases.json against the RUNNING backend
 * (POST /screening/evaluate) and reports PASS / FAIL per case.
 *
 * Usage, from the backend folder, with `npm run start:dev` running:
 *   node test-cases/run-rule-tests.mjs
 *   node test-cases/run-rule-tests.mjs http://localhost:3000
 *
 * Results are also written to test-cases/rule-test-results.csv.
 * Exit code is 0 when every case passes, 1 otherwise.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const baseUrl = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const file = JSON.parse(
  readFileSync(join(here, 'rule-base-cases.json'), 'utf8'),
);
const cases = [...file.ruleCases, ...file.boundaryCases];

/** Picks the fields under test out of the API response. */
function actualOf(body) {
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

const rows = [];
for (const testCase of cases) {
  let actual = {};
  let problem = '';
  try {
    const response = await fetch(`${baseUrl}/screening/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testCase.input),
    });
    const body = await response.json();
    if (response.ok) {
      actual = actualOf(body);
    } else {
      problem = `HTTP ${response.status}: ${JSON.stringify(body.message ?? body)}`;
    }
  } catch (error) {
    console.error(
      `Could not reach ${baseUrl}. Is the backend running (npm run start:dev)?`,
    );
    console.error(String(error?.cause ?? error));
    process.exit(1);
  }

  const mismatches = Object.keys(testCase.expected).filter(
    (key) => actual[key] !== testCase.expected[key],
  );
  if (!problem && mismatches.length > 0) {
    problem = mismatches
      .map((key) => `${key}: expected ${testCase.expected[key]}, got ${actual[key]}`)
      .join('; ');
  }
  rows.push({ testCase, actual, passed: problem === '', problem });
}

// ---- Console report ----
const pad = (value, width) => String(value ?? '-').padEnd(width);
console.log(`\nRule base test run against ${baseUrl}\n`);
console.log(
  pad('Case', 8) + pad('Workload', 18) + pad('Exhaustion', 12) +
    pad('Disengagement', 15) + pad('Expected', 20) + pad('Actual', 20) + 'Result',
);
console.log('-'.repeat(99));
for (const { testCase, actual, passed } of rows) {
  const e = testCase.expected;
  console.log(
    pad(testCase.id, 8) +
      pad(`${e.nasaScore} ${e.workloadLevel}`, 18) +
      pad(`${e.exhaustionScore} ${e.exhaustionLevel}`, 12) +
      pad(`${e.disengagementScore} ${e.disengagementLevel}`, 15) +
      pad(`${e.ruleId} ${e.category}`, 20) +
      pad(`${actual.ruleId ?? '-'} ${actual.category ?? ''}`, 20) +
      (passed ? 'PASS' : 'FAIL'),
  );
}
const failed = rows.filter((row) => !row.passed);
if (failed.length > 0) {
  console.log('\nFailures:');
  for (const { testCase, problem } of failed) {
    console.log(`  ${testCase.id}: ${problem}`);
  }
}
console.log(
  `\n${rows.length - failed.length} of ${rows.length} passed` +
    (failed.length > 0 ? `, ${failed.length} FAILED` : ''),
);

// ---- CSV report (e.g. for the testing chapter) ----
const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const header = [
  'Case', 'Description', 'NASA-TLX score', 'Workload level',
  'Exhaustion score', 'Exhaustion level', 'Disengagement score',
  'Disengagement level', 'Expected rule', 'Expected category',
  'Actual rule', 'Actual category', 'Actual recommendation', 'Result',
];
const lines = rows.map(({ testCase, actual, passed }) => {
  const e = testCase.expected;
  return [
    testCase.id, testCase.title, e.nasaScore, e.workloadLevel,
    e.exhaustionScore, e.exhaustionLevel, e.disengagementScore,
    e.disengagementLevel, e.ruleId, e.category,
    actual.ruleId, actual.category, actual.recommendation,
    passed ? 'PASS' : 'FAIL',
  ].map(quote).join(',');
});
const csvPath = join(here, 'rule-test-results.csv');
// The leading BOM makes Excel read the file as UTF-8.
writeFileSync(csvPath, '﻿' + [header.map(quote).join(','), ...lines].join('\r\n') + '\r\n');
console.log(`Results written to ${csvPath}`);

process.exit(failed.length > 0 ? 1 : 0);
