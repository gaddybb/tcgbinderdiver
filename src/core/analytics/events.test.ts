import { describe, expect, it } from 'vitest';
import { EVENTS, cleanParams } from './events';

describe('cleanParams', () => {
  it('keeps the counts and labels an event is allowed to carry', () => {
    expect(cleanParams('stop_finished', { stop_type: 'set_binder', found: 4, unfound: 2 })).toEqual({ stop_type: 'set_binder', found: 4, unfound: 2 });
    expect(cleanParams('list_pasted', { cards: 14, target: 'deck' })).toEqual({ cards: 14, target: 'deck' });
    expect(cleanParams('plan_viewed', { cards: 20, stops: 3 })).toEqual({ cards: 20, stops: 3 });
    expect(cleanParams('buy_rest_tapped', { cards: 5 })).toEqual({ cards: 5 });
    expect(cleanParams('card_found', { stop_type: 'display_case' })).toEqual({ stop_type: 'display_case' });
  });

  it('never lets a card name or a list name through, even under an allowed key', () => {
    expect(cleanParams('card_found', { stop_type: 'Sol Ring' })).toEqual({});
    expect(cleanParams('list_pasted', { cards: 3, target: 'Lifegain Commander' })).toEqual({ cards: 3 });
  });

  it('drops details an event does not list', () => {
    expect(cleanParams('card_found', { stop_type: 'set_binder', name: 'Sol Ring', list: 'Mine' })).toEqual({ stop_type: 'set_binder' });
    expect(cleanParams('plan_viewed', { cards: 2, stops: 1, names: ['Sol Ring'] })).toEqual({ cards: 2, stops: 1 });
  });

  it('keeps counts as whole numbers and drops anything that is not a number', () => {
    expect(cleanParams('buy_rest_tapped', { cards: 4.6 })).toEqual({ cards: 5 });
    expect(cleanParams('buy_rest_tapped', { cards: NaN })).toEqual({});
    expect(cleanParams('buy_rest_tapped', { cards: '5' })).toEqual({});
  });

  it('has the five events the scope lists', () => {
    expect(EVENTS).toEqual(['list_pasted', 'plan_viewed', 'stop_finished', 'card_found', 'buy_rest_tapped']);
  });
});
