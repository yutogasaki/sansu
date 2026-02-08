import React from 'react';
import { IkimonoStage } from './types';

interface IkimonoSvgProps {
    stage: IkimonoStage;
}

// 段階ごとの画像・スケール・CSSフィルター
// egg → ぼんやり光る球体、hatching → 形が見え始める、small〜adult → 同じ画像のサイズ違い
const STAGE_CONFIG: Record<string, {
    image: string;
    scale: number;
    blur: number;       // CSSブラー（px）
    brightness: number; // 輝度（1が標準）
    saturate: number;   // 彩度（1が標準）
}> = {
    egg:      { image: '/ikimono/egg.png',      scale: 0.75, blur: 2,   brightness: 1.1, saturate: 0.9 },
    hatching: { image: '/ikimono/hatching.png',  scale: 0.8,  blur: 0.5, brightness: 1.05, saturate: 1 },
    small:    { image: '/ikimono/body.png',      scale: 0.7,  blur: 0,   brightness: 1,   saturate: 1 },
    medium:   { image: '/ikimono/body.png',      scale: 0.85, blur: 0,   brightness: 1,   saturate: 1 },
    adult:    { image: '/ikimono/body.png',      scale: 1.0,  blur: 0,   brightness: 1,   saturate: 1 },
    fading:   { image: '/ikimono/body.png',      scale: 1.0,  blur: 1,   brightness: 1.05, saturate: 0.8 },
};

export const IkimonoSvg: React.FC<IkimonoSvgProps> = ({ stage }) => {
    const config = STAGE_CONFIG[stage] || STAGE_CONFIG.egg;

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
                src={config.image}
                alt=""
                className="w-[140%] h-[140%] object-cover pointer-events-none"
                draggable={false}
            />
        </div>
    );
};
