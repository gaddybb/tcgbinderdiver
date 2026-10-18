import { useCallback, useEffect, useRef, useState } from 'react';
import type { FoundName, FuzzyResult, GameConnector } from '../../../core/connector';
import { resolveLines } from '../../../core/import';
import type { ImportLine } from '../../../core/import';
import type { CombinedEntry } from '../../../core/parse/parseDecklist';

export const RETRY_AFTER_MS = 30_000;

export interface LookupState {
  phase: 'running' | 'trouble' | 'done';
  done: number;                 // names answered so far, found or not
  lines: ImportLine[] | null;   // set when done
  retryNow: () => void;
}

interface Answers { entries: readonly CombinedEntry[]; found: Map<string, FoundName>; fuzzy: Map<string, FuzzyResult> }

// Looks up every pasted name (exactly, then typo-tolerant for the ones not found) while `active`. If the source stops
// answering, it keeps what it has, says so, and tries again by itself after 30 seconds or when asked.
export function useLookup(entries: readonly CombinedEntry[], connector: GameConnector, active: boolean): LookupState {
  const answers = useRef<Answers>({ entries, found: new Map(), fuzzy: new Map() });
  const [progress, setProgress] = useState<{ phase: LookupState['phase']; done: number; lines: ImportLine[] | null }>({ phase: 'running', done: 0, lines: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const memo = answers.current;
    if (memo.entries !== entries) {
      memo.entries = entries;
      memo.found.clear();
      memo.fuzzy.clear();
    }
    const count = () => memo.found.size + memo.fuzzy.size;

    (async () => {
      try {
        const remaining = entries.filter(e => !memo.found.has(e.name) && !memo.fuzzy.has(e.name)).map(e => e.name);
        const lookup = remaining.length === 0 ? { found: [], notFound: [] } : await connector.lookupNames(remaining, {
          signal: controller.signal,
          onBatch: batch => {
            for (const f of batch.found) memo.found.set(f.requested, f);
            if (!controller.signal.aborted) setProgress(p => ({ ...p, done: count() }));
          },
        });
        for (const f of lookup.found) memo.found.set(f.requested, f);
        for (const name of lookup.notFound) {
          if (memo.fuzzy.has(name)) continue;
          memo.fuzzy.set(name, await connector.fuzzy(name, controller.signal));
          if (!controller.signal.aborted) setProgress(p => ({ ...p, done: count() }));
        }
        if (controller.signal.aborted) return;
        setProgress({ phase: 'done', done: entries.length, lines: resolveLines(entries, [...memo.found.values()], memo.fuzzy) });
      } catch {
        if (controller.signal.aborted) return;
        setProgress(p => ({ ...p, phase: 'trouble', done: count() }));
      }
    })();
    return () => controller.abort();
  }, [active, entries, connector, attempt]);

  const retryNow = useCallback(() => {
    setProgress(p => ({ ...p, phase: 'running' }));
    setAttempt(n => n + 1);
  }, []);

  useEffect(() => {
    if (!active || progress.phase !== 'trouble') return;
    const timer = setTimeout(retryNow, RETRY_AFTER_MS);
    return () => clearTimeout(timer);
  }, [active, progress.phase, retryNow]);

  return { ...progress, retryNow };
}
