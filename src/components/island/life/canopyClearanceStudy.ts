import { canopyAtmosphereStudy } from './canopyAtmosphereStudy';

const requested = import.meta.env.VITE_CANOPY_CLEARANCE_STUDY;
export const canopyClearanceStudy: 'porch' | 'vault' | 'grove' | undefined = canopyAtmosphereStudy === 'shelter'
    && (requested === 'porch' || requested === 'vault' || requested === 'grove') ? requested : undefined;
export const canopyClearanceHeights = { porch: .82, vault: 1, grove: 1.12 } as const;
export const canopyClearanceCandidate = canopyClearanceStudy ? `canopy-clearance-${canopyClearanceStudy}-study-v1` : undefined;
