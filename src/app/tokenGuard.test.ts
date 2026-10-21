// @vitest-environment node
// Guards CLAUDE.md rule 1: colors, fonts, pixel sizes and breakpoints live in the theme files only.
// If this fails, move the value into src/app/theme (a token) and reference the variable instead.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = join(process.cwd(), 'src', 'app');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const rel = (path: string) => relative(APP, path).split(sep).join('/');
const isTest = (file: string) => /\.test\.tsx?$/.test(file);

// Theme files may hold raw values; the copy module may hold any words, including "#tag".
const files = walk(APP).filter(f => !rel(f).startsWith('theme/') && !rel(f).startsWith('copy/') && !isTest(f));
const styleFiles = files.filter(f => f.endsWith('.css'));
const sourceFiles = files.filter(f => /\.(ts|tsx|css)$/.test(f));

const offenders = (files: string[], pattern: RegExp, allow?: RegExp) =>
  files.flatMap(file =>
    readFileSync(file, 'utf8').split('\n').flatMap((line, i) => {
      const hits = line.match(pattern) ?? [];
      return hits.filter(hit => !allow?.test(hit)).map(hit => `${rel(file)}:${i + 1} ${hit}`);
    }),
  );

describe('design tokens stay in one place', () => {
  it('finds the component files it is meant to check', () => {
    expect(styleFiles.length).toBeGreaterThan(10);
    expect(sourceFiles.length).toBeGreaterThan(30);
  });

  it('has no hex colors outside the theme', () => {
    expect(offenders(sourceFiles, /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g)).toEqual([]);
  });

  it('has no rgb() or hsl() colors outside the theme', () => {
    expect(offenders(sourceFiles, /\b(?:rgba?|hsla?)\(/g)).toEqual([]);
  });

  it('has no font names outside the theme', () => {
    expect(offenders(sourceFiles, /\b(?:Fraunces|Karla|Hanken|JetBrains|Georgia|Arial|Helvetica|system-ui|sans-serif|serif)\b/g)).toEqual([]);
  });

  it('has no pixel sizes in component styles (1px is allowed for visually hidden inputs)', () => {
    expect(offenders(styleFiles, /\b\d+(?:\.\d+)?px\b/g, /^1px$/)).toEqual([]);
  });

  it('has no media queries in component styles: layout comes from layout/breakpoints.ts', () => {
    expect(offenders(styleFiles, /@media/g)).toEqual([]);
  });

  // reference/policy/constraints.md: tap targets at least 44 px. The board draws a few smaller; the policy wins.
  it('keeps every control size token at the 44 px tap minimum', () => {
    const tokens = readFileSync(join(APP, 'theme', 'tokens.css'), 'utf8');
    const rem = (name: string) => Number(new RegExp(`--${name}:\\s*([\\d.]+)rem`).exec(tokens)?.[1]);
    expect(rem('tap-min')).toBe(2.75);
    for (const name of ['size-button', 'size-button-lg', 'size-chip', 'size-picker', 'size-color-filter-w']) {
      expect(rem(name), name).toBeGreaterThanOrEqual(rem('tap-min'));
    }
  });

  // The brand's smallest text is 12 px: every text size token is at least 0.75rem (12 px at 16 px; the page's root is a little larger),
  // and no component style sets a font size below it.
  it('keeps text at least 12 px', () => {
    const tokens = readFileSync(join(APP, 'theme', 'tokens.css'), 'utf8');
    const sizes = [...tokens.matchAll(/--text-[\w-]+:\s*([\d.]+)rem/g)].map(m => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(10);
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(0.75);
    expect(offenders(styleFiles, /font-size:\s*0?\.[0-6]\d*rem|font-size:\s*0?\.7[0-4]\d*rem/g)).toEqual([]);
  });
});
