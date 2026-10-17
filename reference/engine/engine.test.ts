import { routeCard, buildPlan, finishStop, V1_STORE, Printing, CardInput, StoreProfile, Finish } from './engine';

const NOW = new Date('2026-10-17T00:00:00Z');
let fails = 0;
function check(name: string, ok: boolean, info: unknown = '') { if (!ok) { fails++; console.log('FAIL', name, info); } else console.log('ok  ', name); }

function pr(o: Partial<Printing> & { setCode: string; usd?: string | null; foil?: string | null; etched?: string | null }): Printing {
  return {
    setCode: o.setCode, setName: o.setName ?? o.setCode.toUpperCase(), setType: o.setType ?? 'expansion',
    releasedAt: o.releasedAt ?? '2025-11-14', rarity: o.rarity ?? 'common', collectorNumber: o.collectorNumber ?? '1',
    finishes: o.finishes ?? (['nonfoil'] as Finish[]),
    prices: { usd: o.usd === undefined ? '0.25' : o.usd, usd_foil: o.foil ?? null, usd_etched: o.etched ?? null },
    promo: o.promo ?? false, promoTypes: o.promoTypes ?? [], frameEffects: o.frameEffects ?? [],
    borderColor: o.borderColor ?? 'black', fullArt: o.fullArt ?? false, digital: o.digital ?? false, games: o.games ?? ['paper', 'mtgo'],
  };
}
const card = (name: string, printings: Printing[], typeLine = 'Creature'): CardInput => ({ name, typeLine, printings });
const top = (c: CardInput, s: StoreProfile = V1_STORE) => { const r = routeCard(c, s, NOW); return r.status === 'routed' ? r.ranked[0] : null; };
const store = (o: Partial<StoreProfile>): StoreProfile => ({ ...V1_STORE, ...o });

// 1. expensive printing goes to the display case
check('1 $18 printing -> display case', top(card('Smothering Tithe', [pr({ setCode: 'rna', releasedAt: '2019-01-25', rarity: 'rare', usd: '18.50' })]))?.stop.id === 'case');
// 2. cheap recent common -> its set binder
check('2 recent $0.25 common -> set binder', top(card('Ajani', [pr({ setCode: 'fdn', setType: 'core' })]))?.stop.id === 'set:fdn');
// 3. commander product under $15 -> commander box
check('3 commander $2 -> commander box', top(card('Signet', [pr({ setCode: 'fdc', setType: 'commander', usd: '2.00' })]))?.stop.id === 'commander');
// 4. commander product $22 -> display case, commander box not even candidate for that printing
check('4 commander $22 -> display case', top(card('X', [pr({ setCode: 'fdc', setType: 'commander', usd: '22.00', rarity: 'mythic' })]))?.stop.id === 'case');
// 5. older $6.50 -> ask associate, value binder hint
{ const t = top(card('Archangel', [pr({ setCode: 'm14', setType: 'core', releasedAt: '2013-07-19', rarity: 'mythic', usd: '6.50' })]));
  check('5 older $6.50 -> ask associate (value binders)', t?.stop.id === 'ask' && t.best.hint === 'value binders', t); }
// 6. older $4 -> ask associate, bulk hint
{ const t = top(card('Heliod', [pr({ setCode: 'thb', releasedAt: '2020-01-24', rarity: 'mythic', usd: '4.00' })]));
  check('6 older $4 -> ask associate (bulk boxes)', t?.stop.id === 'ask' && t.best.hint === 'bulk boxes', t); }
// 7. The List grouped with Foundations -> group binder, ignoring age
{ const s = store({ binderGroups: [{ id: 'fdn', name: 'Foundations', setCodes: ['fdn', 'plst'] }] });
  check('7 plst in group -> group binder', top(card('Y', [pr({ setCode: 'plst', setType: 'masterpiece', releasedAt: '2019-01-01', usd: '1.00' })]), s)?.stop.id === 'group:fdn'); }
// 8. not carried sets are ignored
{ const s = store({ notCarried: ['khm'] });
  const r = routeCard(card('Z', [pr({ setCode: 'khm' })]), s, NOW);
  check('8 only printing not carried -> no_stop', r.status === 'no_stop', r); }
// 9. cheap reprint beats expensive original (price fit)
{ const t = top(card('Path', [pr({ setCode: 'fdn', setType: 'core', usd: '0.25' }), pr({ setCode: 'con', releasedAt: '2009-04-30', usd: '16.00', rarity: 'uncommon' })]));
  check('9 cheap recent reprint beats $16 original', t?.stop.id === 'set:fdn', t); }
// 10. special printing scores low: plain common printing wins
{ const t = top(card('Sol', [pr({ setCode: 'sld', setType: 'box', usd: '3.00' }), pr({ setCode: 'fdc', setType: 'commander', usd: '1.50', rarity: 'uncommon' })]));
  check('10 Secret Lair loses to commander printing', t?.stop.id === 'commander', t); }
// 11. unknown price: still routed by set
check('11 null price -> set binder', top(card('N', [pr({ setCode: 'dsk', usd: null })]))?.stop.id === 'set:dsk');
// 12. basic lands skipped unless enabled
check('12 basic land skipped', routeCard(card('Forest', [pr({ setCode: 'fdn' })], 'Basic Land — Forest'), V1_STORE, NOW).status === 'skipped_basic');
check('12b basic land included when on', top(card('Forest', [pr({ setCode: 'fdn', setType: 'core' })], 'Basic Land — Forest'), store({ includeBasicLands: true }))?.stop.id === 'set:fdn');
// 13. digital-only printings dropped
check('13 digital only -> no_stop', routeCard(card('D', [pr({ setCode: 'ymid', digital: true, games: ['arena'] })]), V1_STORE, NOW).status === 'no_stop');
// 14. foil only recent printing still routes to its binder with lower score
{ const t = top(card('F', [pr({ setCode: 'dsk', finishes: ['foil'], usd: null, foil: '3.00' })]));
  check('14 foil-only recent -> set binder', t?.stop.id === 'set:dsk' && t.best.finish === 'foil', t); }
// 15. set binders off -> recent cheap card goes to bulk hint
{ const t = top(card('S', [pr({ setCode: 'fdn', setType: 'core' })]), store({ usesSetBinders: false }));
  check('15 set binders off -> ask associate bulk', t?.stop.id === 'ask' && t.best.hint === 'bulk boxes', t); }
// 16. commander section off -> commander printing routes like a set (commander is not a main set type) -> bulk
{ const t = top(card('C', [pr({ setCode: 'fdc', setType: 'commander', usd: '1.00' })]), store({ hasCommanderSection: false }));
  check('16 commander off -> ask associate', t?.stop.id === 'ask', t); }
// 17. value binders on -> own stop
{ const t = top(card('V', [pr({ setCode: 'm14', setType: 'core', releasedAt: '2013-07-19', usd: '7.00' })]), store({ usesValueBinders: true }));
  check('17 value binders on -> value stop', t?.stop.id === 'value', t); }
// 18. a 3-year-old set is still a binder, 3.1 years is not
check('18 set at 2.9 years -> binder', top(card('A', [pr({ setCode: 'old', releasedAt: '2023-11-20' })]))?.stop.id === 'set:old');
check('18b set at 3.2 years -> ask', top(card('A', [pr({ setCode: 'old', releasedAt: '2023-08-01' })]))?.stop.id === 'ask');
// 19. near tie goes to the busier binder
{ const needed = [
    { key: 'a', copies: 1, card: card('A', [pr({ setCode: 'big', releasedAt: '2026-01-01' })]) },
    { key: 'b', copies: 1, card: card('B', [pr({ setCode: 'big', releasedAt: '2026-01-01' })]) },
    { key: 'c', copies: 1, card: card('C', [pr({ setCode: 'new', releasedAt: '2026-09-01' }), pr({ setCode: 'big', releasedAt: '2026-01-01' })]) }];
  const plan = buildPlan(needed, V1_STORE, NOW);
  check('19 near tie -> busier binder', plan.assignment.get('c') === 'set:big', [...plan.assignment]); }
// 20. plan order: set binders by copies, then commander, case, ask
{ const needed = [
    { key: 'a', copies: 3, card: card('A', [pr({ setCode: 'fdn', setType: 'core' })]) },
    { key: 'b', copies: 1, card: card('B', [pr({ setCode: 'dsk' })]) },
    { key: 'c', copies: 1, card: card('C', [pr({ setCode: 'fdc', setType: 'commander' })]) },
    { key: 'd', copies: 1, card: card('D', [pr({ setCode: 'rna', releasedAt: '2019-01-25', usd: '20.00' })]) },
    { key: 'e', copies: 1, card: card('E', [pr({ setCode: 'thb', releasedAt: '2020-01-24', usd: '1.00' })]) }];
  const plan = buildPlan(needed, V1_STORE, NOW);
  const order = plan.stops.map(s => s.stop.id).join(',');
  check('20 plan order', order === 'set:fdn,set:dsk,commander,case,ask', order); }
// 21. finishing a stop moves only its unfound cards, order frozen
{ const needed = [
    { key: 'a', copies: 1, card: card('A', [pr({ setCode: 'fdn', setType: 'core' }), pr({ setCode: 'fdc', setType: 'commander' })]) },
    { key: 'b', copies: 1, card: card('B', [pr({ setCode: 'fdn', setType: 'core' })]) },
    { key: 'c', copies: 1, card: card('C', [pr({ setCode: 'fdc', setType: 'commander' })]) }];
  const plan = buildPlan(needed, V1_STORE, NOW);
  const after = finishStop(plan, needed, 'set:fdn', new Set(), new Set(['b']));
  check('21 unfound card moves to next stop', after.assignment.get('a') === 'commander', [...after.assignment]);
  check('21b found card leaves the plan', !after.assignment.has('b'));
  const order = after.stops.map(s => s.stop.id).join(',');
  check('21d order frozen', order === 'commander', order); }
// 22. card whose only stop is finished goes to no_stop (Buy the rest)
{ const needed = [{ key: 'x', copies: 1, card: card('X', [pr({ setCode: 'fdn', setType: 'core' })]) }];
  const plan = buildPlan(needed, V1_STORE, NOW);
  const after = finishStop(plan, needed, 'set:fdn', new Set(), new Set());
  check('22 nowhere left -> no_stop', after.noStop.includes('x') && !after.assignment.has('x'), after); }
// 23. value of a stop sums copies x price
{ const needed = [{ key: 'a', copies: 2, card: card('A', [pr({ setCode: 'fdn', setType: 'core', usd: '1.50' })]) }];
  const plan = buildPlan(needed, V1_STORE, NOW);
  check('23 stop value = copies x price', Math.abs(plan.stops[0].value - 3) < 1e-9, plan.stops[0].value); }
// 24. bad price strings are treated as unknown, not NaN
check('24 bad price string -> routed', top(card('B', [pr({ setCode: 'fdn', setType: 'core', usd: 'abc' })]))?.stop.id === 'set:fdn');

console.log(fails ? `${fails} failing` : 'all passing');
process.exit(fails ? 1 : 0);
