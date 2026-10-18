import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Button.module.css';

type Native = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>;

interface TextButtonProps extends Native {
  variant?: 'primary' | 'secondary' | 'text' | 'danger';
  size?: 'md' | 'lg';
  fullWidth?: boolean;
  children: ReactNode;
}

// An icon button has no visible words, so it must say what it does.
interface IconButtonProps extends Native {
  variant: 'icon';
  'aria-label': string;
  quiet?: boolean;
  fullWidth?: never;
  size?: never;
  children: ReactNode;
}

export type ButtonProps = TextButtonProps | IconButtonProps;

export function Button(props: ButtonProps) {
  const { variant = 'primary', type = 'button', children, ...rest } = props;
  const { size, fullWidth, quiet, ...native } = rest as typeof rest & { size?: 'md' | 'lg'; fullWidth?: boolean; quiet?: boolean };
  return (
    <button
      {...native}
      type={type}
      className={cx(styles.button, styles[variant], variant === 'primary' && size === 'lg' && styles.lg, fullWidth && styles.fullWidth, quiet && styles.quiet)}
    >
      {children}
    </button>
  );
}
