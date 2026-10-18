import { describe, expect, it } from 'vitest';
import { Home } from './screens/Home';
import { Kit } from './screens/Kit';
import { ListReview } from './screens/ListReview';
import { MyLists } from './screens/MyLists';
import { NotFound } from './screens/NotFound';
import { matchRoute } from './routes';

describe('matchRoute', () => {
  it('finds each screen', () => {
    expect(matchRoute('/').screen).toBe(Home);
    expect(matchRoute('/kit').screen).toBe(Kit);
    expect(matchRoute('/lists').screen).toBe(MyLists);
  });

  it('passes a path part to the screen as a param', () => {
    const match = matchRoute('/lists/abc-123');
    expect(match.screen).toBe(ListReview);
    expect(match.params).toEqual({ id: 'abc-123' });
  });

  it('decodes the param', () => {
    expect(matchRoute('/lists/a%20b').params).toEqual({ id: 'a b' });
  });

  it('does not mind a trailing slash', () => {
    expect(matchRoute('/lists/').screen).toBe(MyLists);
    expect(matchRoute('/kit/').screen).toBe(Kit);
  });

  it('says not found for anything else', () => {
    expect(matchRoute('/nope').screen).toBe(NotFound);
    expect(matchRoute('/lists/a/b').screen).toBe(NotFound);
    expect(matchRoute('/kit/extra').screen).toBe(NotFound);
  });

  it('says not found, not an error, for a broken address', () => {
    expect(matchRoute('/lists/%E0%A4%A').screen).toBe(NotFound);
  });
});
