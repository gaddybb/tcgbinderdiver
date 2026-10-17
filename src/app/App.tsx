import { copy } from './copy/en';
import { Footer } from './layout/Footer';
import styles from './App.module.css';

export function App() {
  return (
    <div className={styles.shell} data-game="magic">
      <main className={styles.main}>
        <h1 className={styles.title}>{copy.app.name}</h1>
        <p className={styles.lead}>{copy.home.comingSoon}</p>
      </main>
      <Footer />
    </div>
  );
}
