import { Button } from '../../components';
import { copy } from '../../copy/en';
import { useSamples } from '../../data/SampleDecksProvider';

// Try a sample deck: shown to a player with no lists of their own, and only once there are sample decks to show.
export function SampleDeckButton({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const samples = useSamples();
  if (!samples.available) return null;
  return <Button variant="secondary" size={size} onClick={() => { void samples.start(); }}>{copy.sample.button}</Button>;
}
