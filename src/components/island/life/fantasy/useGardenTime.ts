import { useEffect, useState } from 'react';
import { gardenTimeAt, type GardenTime } from './presentation';

/** Resume immediately after backgrounding; sample only the scenery clock. */
export function watchGardenTime(onChange: (time: GardenTime) => void) {
    const refresh = () => { if (document.visibilityState === 'visible') onChange(gardenTimeAt()); };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    return () => {
        window.clearInterval(timer);
        document.removeEventListener('visibilitychange', refresh);
        window.removeEventListener('focus', refresh);
        window.removeEventListener('pageshow', refresh);
    };
}

export function useGardenTime(active = true) {
    const [time, setTime] = useState<GardenTime>(() => gardenTimeAt());
    useEffect(() => { if (active) return watchGardenTime(setTime); }, [active]);
    return time;
}
