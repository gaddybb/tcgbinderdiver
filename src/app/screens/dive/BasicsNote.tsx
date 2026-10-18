import { includeBasicsOn } from './basics';
import { Banner, Button } from '../../components';
import { copy } from '../../copy/en';
import { useStoreSettings } from '../../data/StoreSettingsProvider';

// Basic lands are off the hunt unless the player says otherwise. When a list has some, say so, with the switch right here,
// so a list of basics does not look like it is missing from the plan.
export function BasicsNote({ count }: { count: number }) {
  const { update } = useStoreSettings();
  if (count === 0) return null;
  return (
    <Banner tone="info" title={copy.basicsNote.title(count)} actions={<Button variant="secondary" onClick={() => update(includeBasicsOn)}>{copy.basicsNote.action}</Button>}>
      {copy.basicsNote.detail}
    </Banner>
  );
}
