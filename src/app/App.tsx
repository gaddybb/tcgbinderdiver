import { ToastProvider } from './components';
import { Footer } from './layout/Footer';
import { usePath } from './router';
import { Home } from './screens/Home';
import { Kit } from './screens/Kit';
import { NotFound } from './screens/NotFound';
import styles from './App.module.css';

// Paths the app knows. Anything else is "not found". The footer (Fan Content disclaimer) is on every page.
const ROUTES: Record<string, () => React.JSX.Element> = {
  '/': Home,
  '/kit': Kit,
};

export function App() {
  const path = usePath();
  const Screen = ROUTES[path] ?? NotFound;
  return (
    <ToastProvider>
      <div className={styles.shell}>
        <main className={styles.main}>
          <Screen />
        </main>
        <Footer />
      </div>
    </ToastProvider>
  );
}
