import { describe, expect, it } from 'vitest';
import { DEFAULT_PULL_SETTINGS, pullVerdict } from './engine';
import type { PlanStop, StopKind } from './engine';

const stop = (kind: StopKind, copies: number, value: number): PlanStop =>
  ({ stop: { id: kind, kind, label: kind }, cards: [], copies, value });

describe('pullVerdict', () => {
  it('starts at 2 copies or $10', () => {
    expect(DEFAULT_PULL_SETTINGS).toEqual({ worthPullMinCards: 2, worthPullMinUsd: 10 });
  });

  it('P1 one cheap copy at a set binder -> Buy online', () => {
    expect(pullVerdict(stop('set_binder', 1, 0.25))).toBe('buy_online');
  });

  it('P2 two copies -> Worth a pull', () => {
    expect(pullVerdict(stop('set_binder', 2, 0.5))).toBe('worth_a_pull');
  });

  it('P3 one card worth $10 -> Worth a pull', () => {
    expect(pullVerdict(stop('set_binder', 1, 10))).toBe('worth_a_pull');
  });

  it('P4 one card worth $9.99 -> Buy online', () => {
    expect(pullVerdict(stop('set_binder', 1, 9.99))).toBe('buy_online');
  });

  it('P5 Commander box uses the same rule', () => {
    expect(pullVerdict(stop('commander_box', 1, 1))).toBe('buy_online');
    expect(pullVerdict(stop('commander_box', 3, 1))).toBe('worth_a_pull');
  });

  it('P6 counter stops are always Show staff', () => {
    for (const kind of ['display_case', 'ask_associate', 'value_binder'] as const) {
      expect(pullVerdict(stop(kind, 1, 0.25))).toBe('show_staff');
      expect(pullVerdict(stop(kind, 50, 500))).toBe('show_staff');
    }
  });

  it('P7 custom settings change the label', () => {
    const settings = { worthPullMinCards: 5, worthPullMinUsd: 50 };
    expect(pullVerdict(stop('set_binder', 4, 40), settings)).toBe('buy_online');
    expect(pullVerdict(stop('set_binder', 5, 1), settings)).toBe('worth_a_pull');
    expect(pullVerdict(stop('set_binder', 1, 50), settings)).toBe('worth_a_pull');
  });
});
