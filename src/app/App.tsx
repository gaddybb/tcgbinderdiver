import { ToastProvider } from './components';
import { CardDataProvider } from './data/CardDataProvider';
import { ListsProvider } from './data/ListsProvider';
import { StorageProvider } from './data/StorageProvider';
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
import type { AppStorage } from '../storage';
import styles from './App.module.css';

interface AppProps {
  // Tests pass their own storage and clock; the app uses IndexedDB and the real time.
  storage?: AppStorage;
  clock?: () => Date;
  connector?: GameConnector;
}

// The footer (Fan Content disclaimer) is on every page.
export function App({ storage, clock, connector }: AppProps = {}) {
  const { screen: Screen, params } = matchRoute(usePath());
  const phone = useLayout() === 'phone';
  return (
    <ToastProvider>
      <div className={cx(styles.shell, phone && styles.shellPhone)}>
        <SiteNav />
        <OfflineBanner />
        <main className={cx(styles.main, phone && styles.mainPhone)}>
          <StorageProvider storage={storage}>
            <ListsProvider clock={clock}>
              <StoreSettingsProvider>
                <TripProvider>
                  <CardDataProvider connector={connector}>
                    <Screen params={params} />
                  </CardDataProvider>
                </TripProvider>
              </StoreSettingsProvider>
            </ListsProvider>
          </StorageProvider>
        </main>
        <Footer />
      </div>
    </ToastProvider>
  );
}
