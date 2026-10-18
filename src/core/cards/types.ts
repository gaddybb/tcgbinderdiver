import type { CardSummary } from '../connector';
import type { Printing } from '../engine/engine';

// What the app knows about one card, kept on the device so a list can open without asking the data source again.
export interface CardRecord {
  key: string;             // the list entry's cardKey: the same card on several lists shares one record
  summary: CardSummary;    // name, type, colors, images, links
  printings: Printing[];   // every paper printing, with prices
  fetchedAt: string;       // ISO time the data was fetched, so old prices can be refreshed
}
