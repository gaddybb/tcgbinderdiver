// @vitest-environment node
// Magic's routing must not change as the engine learns about other games (docs/MULTI-GAME.md, section 8). This routes every card of
// the committed fixture catalog under several store profiles, with the whole plan and a finished stop, and pins a hash of the result.
// The hash was taken before the engine took `rules`. If it changes, Magic's routing changed: that needs a reason, and the spec.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decodeCatalog, encodeScryfallCards } from '../catalog';
import fixture from '../catalog/fixtures/default-cards.sample.jsonl?raw';
import { buildPlan, finishStop, MAGIC_RULES, routeCard, V1_STORE } from './engine';
import type { CardInput, GameRules, NeededCard, StoreProfile } from './engine';
import { NOW, card, pr, top } from './fixtures';

const built = encodeScryfallCards(fixture.split('\n').filter(l => l.trim()).map(l => JSON.parse(l) as unknown));
const catalog = decodeCatalog(built.cards, built.prices);
const cards: CardInput[] = catalog.cards.map(c => ({ name: c.name, typeLine: c.typeLine, printings: c.printings }));

const STORES: Record<string, StoreProfile> = {
  v1: V1_STORE,
  noCommanderBox: { ...V1_STORE, hasCommanderSection: false },
  noCaseWithBasics: { ...V1_STORE, usesDisplayCase: false, includeBasicLands: true },
  valueBinders: { ...V1_STORE, usesValueBinders: true, valueBinderMin: 1, setBinderMaxAgeYears: 8, displayCaseMin: 5 },
  grouped: { ...V1_STORE, binderGroups: [{ id: 'g', name: 'Old core', setCodes: cards.flatMap(c => c.printings.slice(0, 2).map(p => p.setCode)) }], notCarried: ['plst'] },
};

function everything() {
  const out: unknown[] = [];
  for (const [name, store] of Object.entries(STORES)) {
    const routes = cards.map(c => routeCard(c, store, NOW));
    const needed: NeededCard[] = cards.map((card, i) => ({ key: card.name, card, copies: (i % 3) + 1 }));
    const plan = buildPlan(needed, store, NOW);
    const first = plan.stops[0]?.stop.id;
    const after = first ? finishStop(plan, needed, first, new Set([first]), new Set()) : plan;
    const view = (p: typeof plan) => ({ stops: p.stops.map(s => [s.stop.id, s.copies, s.value, s.cards.map(c => [c.key, c.candidate.printing.setCode, c.candidate.finish, c.candidate.score])]), noStop: p.noStop, skipped: p.skipped, order: p.order });
    out.push([name, routes, view(plan), view(after)]);
  }
  return out;
}

describe('the rules are what the engine reads', () => {
  const commander = card('Signet', [pr({ setCode: 'fdc', setType: 'commander', usd: '2.00' })]);
  const route = (rules: GameRules) => { const r = routeCard(commander, V1_STORE, NOW, rules); return r.status === 'routed' ? r.ranked[0].stop.id : r.status; };

  it('Magic has a Commander box; a game whose rules name no Commander set type does not', () => {
    expect(route(MAGIC_RULES)).toBe('commander');
    expect(route({ ...MAGIC_RULES, commanderSetType: null })).not.toBe('commander');
    expect(top(commander)?.stop.id).toBe('commander');
  });

  it('a game can weigh things its own way', () => {
    const heavy: GameRules = { ...MAGIC_RULES, weights: { ...MAGIC_RULES.weights, base: { ...MAGIC_RULES.weights.base, commander_box: 0.1 } } };
    const r = routeCard(commander, V1_STORE, NOW, heavy);
    expect(r.status === 'routed' && r.ranked[0].score).toBeLessThan(0.2);
  });
});

describe('Magic routing is unchanged', () => {
  it('routes the fixture catalog the same under five store profiles', () => {
    const text = JSON.stringify(everything());
    expect(createHash('sha256').update(text).digest('hex').slice(0, 12)).toBe('b05f75b904b2');
  });
});
