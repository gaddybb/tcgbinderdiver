// Turns a hand-off into the text after the # of a link, and back. The text after the # is never sent to a server.
// "0." is the data as it is, "1." is the same data deflated (smaller, where the browser can do it).
import { fromWire, toWire } from '../../core/handoff';
import type { Handoff } from '../../core/handoff';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function run(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  // A failure shows up when the result is read below, so the write's own promise is not left to reject on its own.
  void writer.write(bytes).then(() => writer.close()).catch(() => undefined);
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

export async function encodeHandoff(handoff: Handoff): Promise<string> {
  const plain = encoder.encode(toWire(handoff));
  const asIs = `0.${toBase64Url(plain)}`;
  if (typeof CompressionStream === 'undefined') return asIs;
  try {
    const packed = `1.${toBase64Url(await run(plain, new CompressionStream('deflate-raw')))}`;
    return packed.length < asIs.length ? packed : asIs;
  } catch {
    return asIs;
  }
}

// Null for anything that is not a hand-off this app wrote.
export async function decodeHandoff(text: string): Promise<Handoff | null> {
  const kind = text.slice(0, 2);
  const body = text.slice(2);
  try {
    if (kind === '0.') return fromWire(decoder.decode(fromBase64Url(body)));
    if (kind === '1.' && typeof DecompressionStream !== 'undefined') {
      return fromWire(decoder.decode(await run(fromBase64Url(body), new DecompressionStream('deflate-raw'))));
    }
  } catch {
    return null;
  }
  return null;
}

// The address that opens a hand-off on another device.
export const handoffLink = (origin: string, encoded: string): string => `${origin}/open#${encoded}`;
