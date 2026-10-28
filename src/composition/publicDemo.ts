import {
  loadAudioMaintenanceCatalog,
  toInitialChecklistCatalog,
} from '../infrastructure/catalogs/AudioMaintenanceCatalog';
import { createDemoSource } from '../presentation/demo/createDemoSource';

/** Public preview composition: never connect this factory to private data or authenticated adapters. */
export function createPublicDemoSource() {
  return createDemoSource(
    toInitialChecklistCatalog(loadAudioMaintenanceCatalog()),
  );
}
