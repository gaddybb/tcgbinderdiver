// What card detail shows for a card: the places to look and the printings, from the same engine the plan uses.
import { useMemo } from 'react';
import { typicalOnline } from '../../../core/cards';
import type { CardRecord } from '../../../core/cards';
import { cardPlaces, printingRows } from '../../../core/cardDetail';
import type { CardPlaces, PrintingRow } from '../../../core/cardDetail';
import { isColorCategory } from '../../components';
import type { ColorCategory } from '../../components';
import { useConnector } from '../../data/CardDataProvider';
import { useLists } from '../../data/ListsProvider';
import { useStoreSettings } from '../../data/StoreSettingsProvider';

export interface DetailModel {
  name: string;
  typeLine: string;
  imageUrl: string | null;
  edge: ColorCategory;
  typical: number | null;
  places: CardPlaces;
  printings: PrintingRow[];
}

// `hereStopId` is the binder being searched, when card detail opens from the store.
export function useDetailModel(record: CardRecord | undefined, hereStopId?: string): DetailModel | null {
  const { profile } = useStoreSettings();
  const { now } = useLists();
  const connector = useConnector();
  return useMemo(() => {
    if (!record) return null;
    const places = cardPlaces({ name: record.summary.name, typeLine: record.summary.typeLine, printings: record.printings }, profile, now(), hereStopId);
    const planned = places.status === 'routed' ? { setCode: places.first.printing.setCode, collectorNumber: places.first.printing.collectorNumber } : undefined;
    const category = connector.sortCategory(record.summary);
    return {
      name: record.summary.name,
      typeLine: record.summary.typeLine,
      imageUrl: record.summary.imageNormal ?? record.summary.imageSmall,
      edge: isColorCategory(category) ? category : 'Colorless',
      typical: typicalOnline(record.printings),
      places,
      printings: printingRows(record.printings, profile, planned),
    };
  }, [record, profile, now, hereStopId, connector]);
}
