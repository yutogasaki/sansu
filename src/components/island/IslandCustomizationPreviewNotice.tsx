import { Sparkles } from 'lucide-react';
import type { IslandCosmetics } from '../../domain/island/customization';
import { sameIslandCosmetics } from './islandCustomizationPreview';

export function IslandCustomizationPreviewNotice({ preview, saved }: { preview: IslandCosmetics; saved: IslandCosmetics }) {
    return <span className="island-customization-stage-label" data-testid="island-customization-preview-label">
        <Sparkles size={14} aria-hidden="true" />{sameIslandCosmetics(preview, saved) ? 'いまの しま' : 'おためし'}</span>;
}
