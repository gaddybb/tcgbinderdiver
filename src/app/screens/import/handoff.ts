// A decklist pasted on the home page, carried to the import flow in memory only (it is never saved or put in an address).
let pending = '';

export const setImportText = (text: string): void => { pending = text; };
export const peekImportText = (): string => pending;
export const clearImportText = (): void => { pending = ''; };
