import { copy } from '../copy/en';
import { StandaloneLink } from '../components';
import styles from './Screen.module.css';

// A stand-in until the real Home screen (a later PR).
export function Home() {
  return (
    <>
      <h1 className={styles.title}>{copy.app.name}</h1>
      <p className={styles.lead}>{copy.home.comingSoon}</p>
      <StandaloneLink to="/kit">{copy.home.kitLink}</StandaloneLink>
    </>
  );
}
