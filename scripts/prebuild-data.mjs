// Runs before `npm run build` (npm does this by itself). Builds the card data into public/data/<game>/ so the deployed site has
// it, but only where that is meant to happen:
//   - on Cloudflare's build (it sets WORKERS_CI) and in the daily refresh workflow (sets CARD_DATA=1): real download
//   - everywhere else (your machine, pull request checks): nothing, so builds stay offline and fast. The app then
//     uses the live Scryfall API, or whatever `npm run data` / `npm run data:fixture` already put in public/data.
// If the download fails, the build fails, so a Scryfall outage never ships a site with missing data (the old deploy stays).
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'build-card-data.mjs');
const wanted = process.env.CARD_DATA === '1' || process.env.WORKERS_CI === '1' || process.env.WORKERS_CI === 'true';

if (!wanted) {
  console.log('Skipping card data (set CARD_DATA=1 to build it).');
} else {
  const result = spawnSync(process.execPath, [script], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error('Card data build failed, so the site build stops here.');
    process.exit(result.status ?? 1);
  }
}
