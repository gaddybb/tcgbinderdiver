import { Banner, Button } from '../../components';
import { copy } from '../../copy/en';
import { usePreference } from '../../data/usePreference';
import { useInstallOffer } from '../../pwa/install';

// Offered on the home page and on the trip summary after a first trip. Not offered again
// after Install or Not now, and only where the browser can install it.
export function InstallBanner() {
  const { canInstall, install } = useInstallOffer();
  const [answered, setAnswered, loaded] = usePreference<'no' | 'yes'>('install-answered', 'no');
  if (!canInstall || !loaded || answered === 'yes') return null;

  return (
    <Banner
      tone="info"
      title={copy.install.title}
      actions={
        <>
          <Button onClick={() => { void install().then(() => setAnswered('yes')); }}>{copy.install.action}</Button>
          <Button variant="text" onClick={() => setAnswered('yes')}>{copy.install.later}</Button>
        </>
      }
    >
      {copy.install.detail}
    </Banner>
  );
}
