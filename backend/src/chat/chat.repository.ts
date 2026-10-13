import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { ChatResultContext } from './chat.prompt.js';
import { isChatIntent } from './chat.types.js';
import type { IntentExample, PassageMatch } from './chat.types.js';

/** pgvector values arrive as text, e.g. "[0.12,-0.03,...]". */
function parseVector(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map(Number);
  }
  if (typeof value === 'string') {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(Number) : [];
  }
  return [];
}

@Injectable()
export class ChatRepository {
  /** The examples change only when the index script runs, so they are kept in memory. */
  private examples: { loadedAt: number; rows: IntentExample[] } | null = null;
  private static readonly CACHE_MS = 5 * 60 * 1000;

  constructor(private readonly supabase: SupabaseService) {}

  async loadIntentExamples(): Promise<IntentExample[]> {
    const cached = this.examples;
    if (cached && Date.now() - cached.loadedAt < ChatRepository.CACHE_MS) {
      return cached.rows;
    }
    const { data, error } = await this.supabase.admin
      .from('kb_intent_examples')
      .select('id, intent, embedding')
      .order('id');
    if (error) {
      throw new Error(`Loading intent examples failed: ${error.message}`);
    }
    const rows: IntentExample[] = [];
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      if (typeof row.id === 'string' && isChatIntent(row.intent)) {
        rows.push({
          id: row.id,
          intent: row.intent,
          embedding: parseVector(row.embedding),
        });
      }
    }
    // An empty table is not cached, so indexing takes effect straight away.
    this.examples = rows.length > 0 ? { loadedAt: Date.now(), rows } : null;
    return rows;
  }

  async matchPassages(
    embedding: number[],
    count: number,
  ): Promise<PassageMatch[]> {
    const { data, error } = await this.supabase.admin.rpc('match_kb_passages', {
      query_embedding: JSON.stringify(embedding),
      match_count: count,
    });
    if (error) {
      throw new Error(`Knowledge base search failed: ${error.message}`);
    }
    const matches: PassageMatch[] = [];
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      if (
        typeof row.id === 'string' &&
        typeof row.content === 'string' &&
        isChatIntent(row.topic)
      ) {
        matches.push({
          id: row.id,
          topic: row.topic,
          content: row.content,
          similarity: Number(row.similarity),
        });
      }
    }
    return matches;
  }

  /** The student's newest screening. Always scoped to that one student. */
  async latestResult(studentId: string): Promise<ChatResultContext | null> {
    const { data, error } = await this.supabase.admin
      .from('screenings')
      .select(
        'category, workload_level, exhaustion_level, disengagement_level, intervention_level',
      )
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new Error(`Loading the latest screening failed: ${error.message}`);
    }
    if (!data) {
      return null;
    }
    const row = data as Record<string, unknown>;
    return {
      category: row.category as ChatResultContext['category'],
      workloadLevel: row.workload_level as ChatResultContext['workloadLevel'],
      exhaustionLevel:
        row.exhaustion_level as ChatResultContext['exhaustionLevel'],
      disengagementLevel:
        row.disengagement_level as ChatResultContext['disengagementLevel'],
      interventionLevel:
        row.intervention_level as ChatResultContext['interventionLevel'],
    };
  }
}
