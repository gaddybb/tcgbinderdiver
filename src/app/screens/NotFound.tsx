import { copy } from '../copy/en';
import { StandaloneLink } from '../components';
import styles from './Screen.module.css';

export function NotFound() {
  return (
    <>
      <h1 className={styles.title}>{copy.notFound.title}</h1>
      <StandaloneLink to="/">{copy.notFound.back}</StandaloneLink>
    </>
  );
}
