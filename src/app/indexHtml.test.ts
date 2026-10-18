// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('index.html', 'utf8');

describe('index.html', () => {
  it('carries the Impact site verification tag in the head, exactly as Impact gave it, for the affiliate application', () => {
    const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
    expect(head).toContain('<meta name="impact-site-verification" value="ffda009a-9e7d-46fc-9867-c99c168351e6" />');
  });

  it('links the web app manifest and the icon', () => {
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(html).toContain('<link rel="icon" href="/icon.svg"');
  });
});
