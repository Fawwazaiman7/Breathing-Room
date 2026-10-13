/**
 * Shared setup for the knowledge base scripts: reads backend/.env, opens
 * Supabase with the secret key, and loads the compiled backend code so the
 * scripts use exactly the same embedding format and intent logic as the
 * running server.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const here = dirname(fileURLToPath(import.meta.url));
export const backendRoot = join(here, '..');

export function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

/** Minimal .env reader: KEY=value per line, spaces around the value ignored. */
export function readEnv() {
  const path = join(backendRoot, '.env');
  if (!existsSync(path)) {
    fail('backend/.env was not found. Run this from the backend folder: node kb/<script>.mjs');
  }
  const env = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || line.trim().startsWith('#')) {
      continue;
    }
    env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

export function requireEnv(env, names) {
  const missing = names.filter((name) => !env[name]);
  if (missing.length > 0) {
    fail(`Missing in backend/.env: ${missing.join(', ')}`);
  }
}

/** Imports one compiled backend file from dist/. */
export async function loadCompiled(relativePath) {
  const path = join(backendRoot, 'dist', relativePath);
  if (!existsSync(path)) {
    fail(
      `Compiled backend code was not found (${join('dist', relativePath)}).\n` +
        'Start the backend once with "npm run start:dev", or run "npm run build", then try again.',
    );
  }
  return import(pathToFileURL(path).href);
}

export async function openSupabase(env) {
  let createClient;
  try {
    ({ createClient } = await import('@supabase/supabase-js'));
  } catch {
    fail('@supabase/supabase-js is not installed. Run "npm install" in the backend folder.');
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function readJson(name) {
  return JSON.parse(readFileSync(join(here, name), 'utf8'));
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calls Gemini and waits when the free tier says "too many requests".
 * `embed` is a function that performs one request.
 */
export async function withRetry(embed, label) {
  const waits = [5000, 15000, 30000, 60000];
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await embed();
    } catch (error) {
      const status = error?.status;
      const retryable = status === 429 || status === 500 || status === 503;
      if (!retryable || attempt >= waits.length) {
        throw error;
      }
      console.log(
        `  ${label}: Gemini answered ${status}, waiting ${waits[attempt] / 1000}s before trying again...`,
      );
      await sleep(waits[attempt]);
    }
  }
}

/** pgvector values arrive as text, e.g. "[0.12,-0.03,...]". */
export function parseVector(value) {
  if (Array.isArray(value)) return value.map(Number);
  if (typeof value === 'string') return JSON.parse(value).map(Number);
  return [];
}
