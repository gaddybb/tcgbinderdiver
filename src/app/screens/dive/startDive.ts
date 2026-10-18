import type { CardList } from '../../../core/lists';
import { navigate } from '../../router';

// Starts a trip with the lists that have cards to find, and opens the store dive.
export function startDive(trip: { start: (listIds: readonly string[]) => unknown }, lists: readonly CardList[]): void {
  trip.start(lists.filter(l => l.entries.some(e => e.status === 'needed')).map(l => l.id));
  navigate('/dive');
}
