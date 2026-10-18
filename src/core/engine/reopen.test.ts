import { describe, expect, it } from 'vitest';
import { buildPlan, finishStop, reopenStop, V1_STORE } from './engine';
import { NOW, card, pr } from './fixtures';

// 'a' ranks the fdn binder first and Commander second (a mythic Commander printing scores lower).
const binderThenCommander = card('A', [
  pr({ setCode: 'fdn', setType: 'expansion', releasedAt: '2026-06-01' }),
  pr({ setCode: 'fdc', setType: 'commander', rarity: 'mythic' }),
]);

function setup() {
  const needed = [
    { key: 'a', copies: 1, card: binderThenCommander },
    { key: 'b', copies: 1, card: card('B', [pr({ setCode: 'fdn', setType: 'expansion', releasedAt: '2026-06-01' })]) },
    { key: 'c', copies: 1, card: card('C', [pr({ setCode: 'fdc', setType: 'commander' })]) },
  ];
  const plan = buildPlan(needed, V1_STORE, NOW);
  return { needed, plan };
}

describe('reopenStop', () => {
  it('setup: a and b start at the fdn binder, c at Commander', () => {
    const { plan } = setup();
    expect(plan.assignment.get('a')).toBe('set:fdn');
    expect(plan.assignment.get('b')).toBe('set:fdn');
    expect(plan.assignment.get('c')).toBe('commander');
    expect(plan.order).toEqual(['set:fdn', 'commander']);
  });

  it('R1 an unfound card comes back to the reopened stop', () => {
    const { needed, plan } = setup();
    const finished = finishStop(plan, needed, 'set:fdn', new Set(), new Set());
    expect(finished.assignment.get('a')).toBe('commander');
    const reopened = reopenStop(finished, needed, 'set:fdn', new Set(['set:fdn']), new Set());
    expect(reopened.assignment.get('a')).toBe('set:fdn');
    expect(reopened.assignment.get('b')).toBe('set:fdn');
  });

  it('R2 a found card does not come back', () => {
    const { needed, plan } = setup();
    const found = new Set(['b']);
    const finished = finishStop(plan, needed, 'set:fdn', new Set(), found);
    const reopened = reopenStop(finished, needed, 'set:fdn', new Set(['set:fdn']), found);
    expect(reopened.assignment.has('b')).toBe(false);
    expect(reopened.assignment.get('a')).toBe('set:fdn');
  });

  it('R3 a card that was never at the stop stays where it is', () => {
    const { needed, plan } = setup();
    const finished = finishStop(plan, needed, 'set:fdn', new Set(), new Set());
    const reopened = reopenStop(finished, needed, 'set:fdn', new Set(['set:fdn']), new Set());
    expect(reopened.assignment.get('c')).toBe('commander');
  });

  it('R4 stop order stays frozen, so the reopened stop returns to its place', () => {
    const { needed, plan } = setup();
    const finished = finishStop(plan, needed, 'set:fdn', new Set(), new Set());
    expect(finished.stops.map(s => s.stop.id)).toEqual(['commander']);
    const reopened = reopenStop(finished, needed, 'set:fdn', new Set(['set:fdn']), new Set());
    expect(reopened.stops.map(s => s.stop.id)).toEqual(['set:fdn', 'commander']);
  });

  it('R5 a card that had nowhere left (no_stop) comes back', () => {
    const needed = [{ key: 'x', copies: 1, card: card('X', [pr({ setCode: 'fdn', setType: 'expansion' })]) }];
    const plan = buildPlan(needed, V1_STORE, NOW);
    const finished = finishStop(plan, needed, 'set:fdn', new Set(), new Set());
    expect(finished.noStop).toContain('x');
    const reopened = reopenStop(finished, needed, 'set:fdn', new Set(['set:fdn']), new Set());
    expect(reopened.noStop).not.toContain('x');
    expect(reopened.assignment.get('x')).toBe('set:fdn');
  });

  it('R6 reopening a stop that is not finished changes nothing', () => {
    const { needed, plan } = setup();
    expect(reopenStop(plan, needed, 'set:fdn', new Set(), new Set())).toBe(plan);
  });

  it('R7 finishing again after a reopen moves the cards on again', () => {
    const { needed, plan } = setup();
    const finished = finishStop(plan, needed, 'set:fdn', new Set(), new Set());
    const reopened = reopenStop(finished, needed, 'set:fdn', new Set(['set:fdn']), new Set());
    const again = finishStop(reopened, needed, 'set:fdn', new Set(), new Set());
    expect(again.assignment.get('a')).toBe('commander');
    expect(again.stops.map(s => s.stop.id)).toEqual(['commander']);
  });

  it('R8 a stop that only gains cards after the first finish is added to the frozen order', () => {
    const needed = [{ key: 'a', copies: 1, card: binderThenCommander }];
    const plan = buildPlan(needed, V1_STORE, NOW);
    expect(plan.order).toEqual(['set:fdn']);
    const finished = finishStop(plan, needed, 'set:fdn', new Set(), new Set());
    expect(finished.order).toEqual(['set:fdn', 'commander']);
    const reopened = reopenStop(finished, needed, 'set:fdn', new Set(['set:fdn']), new Set());
    expect(reopened.stops.map(s => s.stop.id)).toEqual(['set:fdn']);
    expect(reopened.order).toEqual(['set:fdn', 'commander']);
  });
});
