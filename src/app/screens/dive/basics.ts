import { setIncludeBasicLands } from '../../../core/store';
import type { StoreSettings } from '../../../core/store';

export const includeBasicsOn = (settings: StoreSettings): StoreSettings => setIncludeBasicLands(settings, true);
