// Ported one for one from reference/engine/engine.test.ts (check() -> it()), plus 21c.
import { describe, expect, it } from 'vitest';
import { routeCard, buildPlan, finishStop, V1_STORE } from './engine';
import { NOW, pr, card, top, store } from './fixtures';

describe('routing engine', () => {
  it('1 $18 printing -> display case', () => {
    expect(top(card('Smothering Tithe', [pr({ setCode: 'rna', releasedAt: '2019-01-25', rarity: 'rare', usd: '18.50' })]))?.stop.id).toBe('case');
  });

  it('2 recent $0.25 common -> set binder', () => {
    expect(top(card('Ajani', [pr({ setCode: 'fdn', setType: 'core' })]))?.stop.id).toBe('set:fdn');
  });

  it('3 commander $2 -> commander box', () => {
    expect(top(card('Signet', [pr({ setCode: 'fdc', setType: 'commander', usd: '2.00' })]))?.stop.id).toBe('commander');
  });

  // commander product $22 -> display case, commander box not even candidate for that printing
  it('4 commander $22 -> display case', () => {
    expect(top(card('X', [pr({ setCode: 'fdc', setType: 'commander', usd: '22.00', rarity: 'mythic' })]))?.stop.id).toBe('case');
  });

  it('5b a recent set printing beats a Commander reprint of the same card', () => {
    const c = card('Rampant Growth', [pr({ setCode: 'fdn', setType: 'core' }), pr({ setCode: 'fdc', setType: 'commander', releasedAt: '2026-10-02' })]);
    expect(top(c)?.stop.id).toBe('set:fdn');
  });

  it('5c a Commander printing still beats an old bulk printing, so Commander staples go to the box', () => {
    const c = card('Wild Growth', [pr({ setCode: '7ed', setType: 'core', releasedAt: '2001-04-11' }), pr({ setCode: 'c18', setType: 'commander', releasedAt: '2018-08-10' })]);
    expect(top(c)?.stop.id).toBe('commander');
  });

  it('5 older $6.50 -> ask associate (value binders)', () => {
    const t = top(card('Archangel', [pr({ setCode: 'm14', setType: 'core', releasedAt: '2013-07-19', rarity: 'mythic', usd: '6.50' })]));
    expect(t?.stop.id).toBe('ask');
    expect(t?.best.hint).toBe('value binders');
  });

  it('6 older $4 -> ask associate (bulk boxes)', () => {
    const t = top(card('Heliod', [pr({ setCode: 'thb', releasedAt: '2020-01-24', rarity: 'mythic', usd: '4.00' })]));
    expect(t?.stop.id).toBe('ask');
    expect(t?.best.hint).toBe('bulk boxes');
  });

  // The List grouped with Foundations -> group binder, ignoring age
  it('7 plst in group -> group binder', () => {
    const s = store({ binderGroups: [{ id: 'fdn', name: 'Foundations', setCodes: ['fdn', 'plst'] }] });
    expect(top(card('Y', [pr({ setCode: 'plst', setType: 'masterpiece', releasedAt: '2019-01-01', usd: '1.00' })]), s)?.stop.id).toBe('group:fdn');
  });

  it('8 only printing not carried -> no_stop', () => {
    const s = store({ notCarried: ['khm'] });
    expect(routeCard(card('Z', [pr({ setCode: 'khm' })]), s, NOW).status).toBe('no_stop');
  });

  it('9 cheap recent reprint beats $16 original', () => {
    const t = top(card('Path', [pr({ setCode: 'fdn', setType: 'core', usd: '0.25' }), pr({ setCode: 'con', releasedAt: '2009-04-30', usd: '16.00', rarity: 'uncommon' })]));
    expect(t?.stop.id).toBe('set:fdn');
  });

  it('10 Secret Lair loses to commander printing', () => {
    const t = top(card('Sol', [pr({ setCode: 'sld', setType: 'box', usd: '3.00' }), pr({ setCode: 'fdc', setType: 'commander', usd: '1.50', rarity: 'uncommon' })]));
    expect(t?.stop.id).toBe('commander');
  });

  it('11 null price -> set binder', () => {
    expect(top(card('N', [pr({ setCode: 'dsk', usd: null })]))?.stop.id).toBe('set:dsk');
  });

  it('12 basic land skipped', () => {
    expect(routeCard(card('Forest', [pr({ setCode: 'fdn' })], 'Basic Land — Forest'), V1_STORE, NOW).status).toBe('skipped_basic');
  });

  it('12b basic land included when on', () => {
    expect(top(card('Forest', [pr({ setCode: 'fdn', setType: 'core' })], 'Basic Land — Forest'), store({ includeBasicLands: true }))?.stop.id).toBe('set:fdn');
  });

  it('13 digital only -> no_stop', () => {
    expect(routeCard(card('D', [pr({ setCode: 'ymid', digital: true, games: ['arena'] })]), V1_STORE, NOW).status).toBe('no_stop');
  });

  it('14 foil-only recent -> set binder', () => {
    const t = top(card('F', [pr({ setCode: 'dsk', finishes: ['foil'], usd: null, foil: '3.00' })]));
    expect(t?.stop.id).toBe('set:dsk');
    expect(t?.best.finish).toBe('foil');
  });

  it('15 set binders off -> ask associate bulk', () => {
    const t = top(card('S', [pr({ setCode: 'fdn', setType: 'core' })]), store({ usesSetBinders: false }));
    expect(t?.stop.id).toBe('ask');
    expect(t?.best.hint).toBe('bulk boxes');
  });

  // commander section off -> commander printing routes like a set (commander is not a main set type) -> bulk
  it('16 commander off -> ask associate', () => {
    const t = top(card('C', [pr({ setCode: 'fdc', setType: 'commander', usd: '1.00' })]), store({ hasCommanderSection: false }));
    expect(t?.stop.id).toBe('ask');
  });

  it('17 value binders on -> value stop', () => {
    const t = top(card('V', [pr({ setCode: 'm14', setType: 'core', releasedAt: '2013-07-19', usd: '7.00' })]), store({ usesValueBinders: true }));
    expect(t?.stop.id).toBe('value');
  });

  it('18 set at 2.9 years -> binder', () => {
    expect(top(card('A', [pr({ setCode: 'old', releasedAt: '2023-11-20' })]))?.stop.id).toBe('set:old');
  });

  it('18b set at 3.2 years -> ask', () => {
    expect(top(card('A', [pr({ setCode: 'old', releasedAt: '2023-08-01' })]))?.stop.id).toBe('ask');
  });

  it('19 near tie -> busier binder', () => {
    const needed = [
      { key: 'a', copies: 1, card: card('A', [pr({ setCode: 'big', releasedAt: '2026-01-01' })]) },
      { key: 'b', copies: 1, card: card('B', [pr({ setCode: 'big', releasedAt: '2026-01-01' })]) },
      { key: 'c', copies: 1, card: card('C', [pr({ setCode: 'new', releasedAt: '2026-09-01' }), pr({ setCode: 'big', releasedAt: '2026-01-01' })]) }];
    const plan = buildPlan(needed, V1_STORE, NOW);
    expect(plan.assignment.get('c')).toBe('set:big');
  });

  it('20 plan order', () => {
    const needed = [
      { key: 'a', copies: 3, card: card('A', [pr({ setCode: 'fdn', setType: 'core' })]) },
      { key: 'b', copies: 1, card: card('B', [pr({ setCode: 'dsk' })]) },
      { key: 'c', copies: 1, card: card('C', [pr({ setCode: 'fdc', setType: 'commander' })]) },
      { key: 'd', copies: 1, card: card('D', [pr({ setCode: 'rna', releasedAt: '2019-01-25', usd: '20.00' })]) },
      { key: 'e', copies: 1, card: card('E', [pr({ setCode: 'thb', releasedAt: '2020-01-24', usd: '1.00' })]) }];
    const plan = buildPlan(needed, V1_STORE, NOW);
    expect(plan.stops.map(s => s.stop.id).join(',')).toBe('set:fdn,set:dsk,commander,case,ask');
  });

  describe('21 finishing a stop moves only its unfound cards, order frozen', () => {
    const needed = [
      { key: 'a', copies: 1, card: card('A', [pr({ setCode: 'fdn', setType: 'core' }), pr({ setCode: 'fdc', setType: 'commander' })]) },
      { key: 'b', copies: 1, card: card('B', [pr({ setCode: 'fdn', setType: 'core' })]) },
      { key: 'c', copies: 1, card: card('C', [pr({ setCode: 'fdc', setType: 'commander' })]) }];
    const plan = buildPlan(needed, V1_STORE, NOW);
    const after = finishStop(plan, needed, 'set:fdn', new Set(), new Set(['b']));

    it('21 unfound card moves to next stop', () => {
      expect(after.assignment.get('a')).toBe('commander');
    });
    it('21b found card leaves the plan', () => {
      expect(after.assignment.has('b')).toBe(false);
    });
    // added: the spec counts 29 checks, the reference file has no 21c
    it('21c cards at other stops stay put', () => {
      expect(after.assignment.get('c')).toBe('commander');
    });
    it('21d order frozen', () => {
      expect(after.stops.map(s => s.stop.id).join(',')).toBe('commander');
    });
  });

  it('22 nowhere left -> no_stop', () => {
    const needed = [{ key: 'x', copies: 1, card: card('X', [pr({ setCode: 'fdn', setType: 'core' })]) }];
    const plan = buildPlan(needed, V1_STORE, NOW);
    const after = finishStop(plan, needed, 'set:fdn', new Set(), new Set());
    expect(after.noStop).toContain('x');
    expect(after.assignment.has('x')).toBe(false);
  });

  it('23 stop value = copies x price', () => {
    const needed = [{ key: 'a', copies: 2, card: card('A', [pr({ setCode: 'fdn', setType: 'core', usd: '1.50' })]) }];
    const plan = buildPlan(needed, V1_STORE, NOW);
    expect(plan.stops[0].value).toBeCloseTo(3, 9);
  });

  it('24 bad price string -> routed', () => {
    expect(top(card('B', [pr({ setCode: 'fdn', setType: 'core', usd: 'abc' })]))?.stop.id).toBe('set:fdn');
  });
});
