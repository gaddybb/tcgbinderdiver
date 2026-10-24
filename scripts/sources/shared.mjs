// Small helpers the card data sources share. Node only.
import { stat } from 'node:fs/promises';

const ATTEMPTS = 3;

export async function withRetries(label, fn) {
  for (let attempt = 1; ; attempt++) {
    try { return await fn(); } catch (err) {
      if (attempt >= ATTEMPTS) throw new Error(`${label} failed after ${ATTEMPTS} tries: ${err.message}`, { cause: err });
      console.warn(`${label} failed (${err.message}), trying again`);
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
}

export async function exists(file) {
  try { await stat(file); return true; } catch { return false; }
}
