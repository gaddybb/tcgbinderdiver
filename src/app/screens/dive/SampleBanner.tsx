import { Banner, Button } from '../../components';
import { copy } from '../../copy/en';
import { useLists } from '../../data/ListsProvider';
import { useSamples } from '../../data/SampleDecksProvider';
import { navigate } from '../../router';

// At the top of the dive plan while a sample deck is open: what it is, and the two ways out.
export function SampleBanner() {
  const lists = useLists();
  const samples = useSamples();
  const sample = lists.lists.find(l => l.sample);
  if (!sample) return null;

  return (
    <Banner
      tone="info"
      title={copy.sample.banner(sample.name)}
      actions={
        <>
          <Button variant="secondary" onClick={() => { void lists.removeSamples().then(() => navigate('/import')); }}>{copy.sample.paste}</Button>
          {samples.decks.length > 1 && <Button variant="text" onClick={() => { void samples.start(sample.name); }}>{copy.sample.another}</Button>}
        </>
      }
    >
      {copy.sample.detail}
    </Banner>
  );
}
