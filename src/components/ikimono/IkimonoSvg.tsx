import React from 'react';
import { IkimonoStage } from './types';

interface IkimonoSvgProps {
    stage: IkimonoStage;
    species?: number;  // 0〜9、未指定時は 0
}

// ステージから画像サフィックスへのマッピング（1: たまご、2: 孵化中、3: 成体）
function getImageSuffix(stage: IkimonoStage): 1 | 2 | 3 {
    switch (stage) {
        case 'egg': return 1;
        case 'hatching': return 2;
        default: return 3;
    }
}

interface StageVisual {
    scale: number;
    blur: number;
    brightness: number;
    saturate: number;
}

type VisibleStage = Exclude<IkimonoStage, 'gone'>;

const STAGE_CONFIG: Record<VisibleStage, StageVisual> = {
    egg:      { scale: 0.75, blur: 2,   brightness: 1.1, saturate: 0.9 },
    hatching: { scale: 0.8,  blur: 0.5, brightness: 1.05, saturate: 1 },
    small:    { scale: 0.7,  blur: 0,   brightness: 1,   saturate: 1 },
    medium:   { scale: 0.85, blur: 0,   brightness: 1,   saturate: 1 },
    adult:    { scale: 1.0,  blur: 0,   brightness: 1,   saturate: 1 },
    fading:   { scale: 1.0,  blur: 1,   brightness: 1.05, saturate: 0.8 },
};

export const IkimonoSvg: React.FC<IkimonoSvgProps> = ({ stage, species = 0 }) => {
    const config = STAGE_CONFIG[stage as VisibleStage] ?? STAGE_CONFIG.egg;
    const imagePath = `/ikimono/${species}-${getImageSuffix(stage)}.png`;

    const filterParts: string[] = [];
    if (config.blur > 0) filterParts.push(`blur(${config.blur}px)`);
    if (config.brightness !== 1) filterParts.push(`brightness(${config.brightness})`);
    if (config.saturate !== 1) filterParts.push(`saturate(${config.saturate})`);
    const filterValue = filterParts.length > 0 ? filterParts.join(' ') : 'none';

    return (
        <div
            className="w-full h-full flex items-center justify-center rounded-full overflow-hidden"
            style={{
                transform: `scale(${config.scale})`,
                transition: 'transform 1s ease, filter 1s ease',
                filter: filterValue,
            }}
        >
            <img
                src={imagePath}
                alt=""
                className="w-[140%] h-[140%] object-cover pointer-events-none"
                draggable={false}
            />
        </div>
    );
};
