// Every user-facing string lives here, keyed by screen. Components reference keys, never literals.
// Text in [square brackets] is a placeholder for the owner to fill. Never invent it.

export const en = {
  app: {
    name: 'Binder Diver',
    pageTitle: 'TCG Binder Diver',
    description: 'TCG Binder Diver tells you which store binders to pull for every card on your lists.',
  },
  footer: {
    // Fan Content Policy: verbatim, on every page. Do not edit (see reference/policy/constraints.md).
    fanContentDisclaimer:
      'Binder Diver is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.',
    scryfallCredit: 'Card data and images from Scryfall.',
    scryfallUrl: 'https://scryfall.com',
  },
  home: {
    comingSoon: 'Binder Diver is being built. Check back soon.',
  },
} as const;

export type Copy = typeof en;
export const copy: Copy = en;
