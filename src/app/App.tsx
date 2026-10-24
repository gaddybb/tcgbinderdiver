import { ToastProvider } from './components';
import { AnalyticsProvider } from './analytics/AnalyticsProvider';
import type { AnalyticsConfig } from './analytics/AnalyticsProvider';
import { ConsentBanner } from './analytics/ConsentBanner';
import { CardDataProvider } from './data/CardDataProvider';
import { ListsProvider } from './data/ListsProvider';
import { StorageProvider } from './data/StorageProvider';
import { SampleDecksProvider } from './data/SampleDecksProvider';
import { StoreSettingsProvider } from './data/StoreSettingsProvider';
import { TripProvider } from './data/TripProvider';
import { Footer } from './layout/Footer';
import { OfflineBanner } from './layout/OfflineBanner';
import { SiteNav } from './layout/SiteNav';
import { useLayout } from './layout/useLayout';
import { cx } from './cx';
import { matchRoute } from './routes';
import { usePath } from './router';
import type { GameConnector } from '../core/connector';
import type { SampleDeck } from '../core/lists';
import type { AppStorage } from '../storage';
import styles from './App.module.css';

interface AppProps {
  // Tests pass their own storage and clock; the app uses IndexedDB and the real time.
  storage?: AppStorage;
  clock?: () => Date;
  connector?: GameConnector;
  sampleDecks?: readonly SampleDeck[];   // tests pass their own; the app uses the owner's list
  random?: () => number;
  analytics?: AnalyticsConfig;           // tests pass their own; the app uses the flag and the container id
}

// The footer (Fan Content disclaimer) is on every page.
export function App({ storage, clock, connector, sampleDecks, random, analytics }: AppProps = {}) {
  const { screen: Screen, params } = matchRoute(usePath());
  const phone = useLayout() === 'phone';
  return (
    <ToastProvider>
      <StorageProvider storage={storage}>
      <div className={cx(styles.shell, phone && styles.shellPhone)}>
        <SiteNav />
        <OfflineBanner />
        <main className={cx(styles.main, phone && styles.mainPhone)}>
            <AnalyticsProvider config={analytics}>
            <ListsProvider clock={clock}>
              <SampleDecksProvider decks={sampleDecks} random={random}>
              <StoreSettingsProvider>
                <TripProvider>
                  <CardDataProvider connector={connector}>
                    <Screen params={params} />
                  </CardDataProvider>
                </TripProvider>
              </StoreSettingsProvider>
              </SampleDecksProvider>
            </ListsProvider>
            <ConsentBanner />
            </AnalyticsProvider>
        </main>
        <Footer />
      </div>
      </StorageProvider>
    </ToastProvider>
  );
}
