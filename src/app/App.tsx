import { ToastProvider } from './components';
import { ListsProvider } from './data/ListsProvider';
import { StorageProvider } from './data/StorageProvider';
import { Footer } from './layout/Footer';
import { matchRoute } from './routes';
import { usePath } from './router';
import type { AppStorage } from '../storage';
import styles from './App.module.css';

interface AppProps {
  // Tests pass their own storage and clock; the app uses IndexedDB and the real time.
  storage?: AppStorage;
  clock?: () => Date;
}

// The footer (Fan Content disclaimer) is on every page.
export function App({ storage, clock }: AppProps = {}) {
  const { screen: Screen, params } = matchRoute(usePath());
  return (
    <ToastProvider>
      <div className={styles.shell}>
        <main className={styles.main}>
          <StorageProvider storage={storage}>
            <ListsProvider clock={clock}>
              <Screen params={params} />
            </ListsProvider>
          </StorageProvider>
        </main>
        <Footer />
      </div>
    </ToastProvider>
  );
}
