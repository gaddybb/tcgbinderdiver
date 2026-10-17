# TCG Binder Diver

A free, phone-first web app that tells Magic players which store binders to pull for every card on their lists.
It predicts where cards are likely to be from print history; it never sees store stock.

Binder Diver is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.
Card data and images from [Scryfall](https://scryfall.com).

## Develop

Node 22.19 or newer.

```bash
npm install
npm run dev      # local dev server
npm test         # Vitest
npm run lint     # ESLint and type check
npm run build    # production build to dist/
```

## Deploy

Cloudflare Pages: build command `npm run build`, output directory `dist`.

## Docs

- `reference/README.md`: product, policy, engine and design references.
- `docs/PLAN.md`: build plan and PR order.
- `CHANGELOG.md`: release notes.

## License

MIT. See `LICENSE`.
