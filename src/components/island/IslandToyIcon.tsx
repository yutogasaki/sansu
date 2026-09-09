import type { SVGProps } from 'react';
import './IslandToyIcon.css';

type Toy = 'island' | 'house' | 'album' | 'camera' | 'keepsake' | 'gift' | 'display' | 'play' | 'find' | 'box' | 'palette' | 'boat';
type Props = SVGProps<SVGSVGElement> & { kind: Toy; size?: number };
/** Small navigation objects: fixed silhouettes and color masses, never state or rewards. */
export function IslandToyIcon({ kind, size = 40, className = '', ...props }: Props) {
    const blue = 'var(--toy-blue)', pink = 'var(--toy-pink)', yellow = 'var(--toy-yellow)', mint = 'var(--toy-mint)', paper = 'var(--pokomoko-paper)';
    const drawings = {
        island: <><path fill={blue} d="M5 37Q12 29 24 32Q43 27 44 38Q38 47 20 44Q7 44 5 37Z"/><path fill={mint} d="M8 34Q13 26 22 29Q34 23 40 34Q29 41 8 34Z"/><path fill={yellow} d="M22 33Q29 23 22 14L27 12Q35 24 28 34Z"/><path fill={pink} d="M12 17Q6 8 18 7Q25 0 29 9Q43 6 40 18Q27 25 12 17Z"/><circle cx="18" cy="12" r="2.4" fill={paper} stroke="none"/><circle cx="31" cy="15" r="3" fill={paper} stroke="none"/></>,
        house: <><path fill={yellow} d="M12 21L37 19L39 41Q24 46 10 40Z"/><path fill={pink} d="M5 23Q17 14 21 5Q25 17 43 21Q27 29 5 23Z"/><path fill={blue} d="M24 42L24 32Q29 27 33 32L33 42"/><rect x="14" y="28" width="6" height="6" rx="2" fill={paper}/><circle cx="23" cy="17" r="3" fill={paper} stroke="none"/></>,
        album: <><path fill={paper} d="M8 9L37 7L41 37L12 43Z"/><path fill={pink} d="M6 7L34 5L38 36L10 41Z"/><path d="M12 8L16 39"/><path fill={yellow} d="M19 14L29 12L31 25L20 27Z"/><path d="M22 22L25 18L29 23" fill={mint}/><path d="M8 15L13 14M9 24L14 23M11 33L16 32"/></>,
        camera: <><path fill={yellow} d="M14 15L17 9H29L33 15"/><rect x="5" y="15" width="38" height="27" rx="8" fill={blue}/><circle cx="25" cy="28" r="10" fill={paper}/><circle cx="25" cy="28" r="6" fill={mint}/><circle cx="27" cy="26" r="2" fill={paper} stroke="none"/><path d="M10 20H13" stroke={yellow}/></>,
        keepsake: <><path fill={yellow} d="M14 10H6Q4 26 18 26M34 10H42Q44 26 30 26"/><path fill={yellow} d="M13 7H35L33 23Q30 31 24 31Q15 29 14 22Z"/><path d="M24 31V38"/><path fill={pink} d="M14 38H34L37 43H11Z"/><path fill={paper} d="M24 12L26 17L31 18L27 21L28 26L24 23L20 26L21 21L17 18L22 17Z" strokeWidth="1.2"/></>,
        gift: <><path fill={pink} d="M9 22H39V41H9Z"/><path fill={yellow} d="M6 16H42V24H6Z"/><path fill={blue} d="M21 17H27V41H21Z"/><path fill={pink} d="M24 16Q6 15 12 6Q20 2 24 16Q28 2 36 7Q41 17 24 16Z"/></>,
        display: <><path fill={yellow} d="M6 38H42V43H6Z"/><path fill={blue} d="M12 37L14 21H27L30 37Z"/><path fill={pink} d="M20 24C2 23 10 11 16 15C10 2 25 2 25 12C35 3 42 17 29 21Q29 29 20 24Z"/><circle cx="22" cy="17" r="4" fill={yellow}/><path fill={mint} d="M31 37V28L38 25L42 37Z"/></>,
        play: <><ellipse cx="24" cy="34" rx="13" ry="10" fill={pink}/><ellipse cx="9" cy="22" rx="5" ry="7" fill={yellow}/><ellipse cx="20" cy="12" rx="5" ry="7" fill={pink}/><ellipse cx="32" cy="13" rx="5" ry="7" fill={yellow}/><ellipse cx="41" cy="25" rx="4" ry="6" fill={pink}/></>,
        find: <><path fill={pink} d="M29 28L43 39L38 45L25 31Z"/><circle cx="21" cy="20" r="15" fill={yellow}/><circle cx="21" cy="20" r="10" fill={paper}/><path d="M16 25Q15 15 25 14Q27 23 16 25Z" fill={mint}/></>,
        box: <><path fill={yellow} d="M10 19L25 24L39 18V37L24 44L10 37Z"/><path fill={pink} d="M10 17L24 22L18 29L4 23ZM24 22L38 16L44 22L30 29Z"/><path d="M24 29V42"/><path fill={mint} d="M20 17Q9 4 20 6L24 14Q30 1 35 8Q37 15 26 19"/></>,
        palette: <><path fill={yellow} d="M26 5C3 3 0 33 16 41C27 47 27 35 34 34C49 35 45 8 26 5Z"/><circle cx="14" cy="20" r="4" fill={pink}/><circle cx="23" cy="12" r="4" fill={blue}/><circle cx="34" cy="18" r="4" fill={mint}/><circle cx="17" cy="32" r="3" fill={paper}/></>,
        boat: <><path fill={blue} d="M5 34H43L35 43H14Z"/><path d="M24 34V5"/><path fill={pink} d="M21 8L7 29H21Z"/><path fill={yellow} d="M27 11L40 29H27Z"/></>,
    };
    return <svg width={size} height={size} {...props} viewBox="0 0 48 48" fill="none" stroke="var(--pokomoko-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`island-toy-icon ${className}`} aria-hidden="true" focusable="false" data-icon-candidate="island-objects-v1">{drawings[kind]}</svg>;
}
export const IslandToyHouse = (props: SVGProps<SVGSVGElement>) => <IslandToyIcon {...props} kind="house" />;
export const IslandToyLand = (props: SVGProps<SVGSVGElement>) => <IslandToyIcon {...props} kind="island" />;
