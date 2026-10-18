import type { ComponentProps } from 'react';
import { Link } from '../router';
import styles from './StandaloneLink.module.css';

// A link that sits on its own line (Back to home, Open): a full-size tap target, unlike a link inside a sentence.
export function StandaloneLink(props: Omit<ComponentProps<typeof Link>, 'className'>) {
  return <Link {...props} className={styles.link} />;
}
