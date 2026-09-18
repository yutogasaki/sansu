import { Home, MapPin, Route, ShoppingBasket } from 'lucide-react';
import type { CellPos, DomainEvent, Resident, WorldState } from '../../domain/natureTown/types';
import { eventMessage } from './livingPresentation';
import LifeResidentPortrait from '../island/life/LifeResidentPortrait';
import { residentAppearance, residentDetails, residentName } from './residentDetails';
export function ResidentPanel({ world, resident, event, onFocus, onClose }: {
    world: WorldState; resident: Resident; event?: DomainEvent; onFocus: (position: CellPos) => void; onClose: () => void;
}) {
    const details = residentDetails(world, resident), home = world.props.find(p => p.id === resident.homeId);
    return <section className="town-resident-detail" aria-label="住人のようす" data-resident-id={resident.id}>
        <div className="town-resident-heading">
            <LifeResidentPortrait resident={residentAppearance(resident)} />
            <div><h2>{residentName(world, resident)}</h2><p>{details.activity}</p></div>
            <button onClick={onClose} aria-label="住人のようすを閉じる">閉じる</button>
        </div>
        <p className="town-resident-cargo"><ShoppingBasket size={18}/>
            {details.carried ? `持っている 食べもの ${details.carried}こ` : details.reserved ? '食べものは まだ 畑のかごにあるよ' : 'いまは 手ぶらだよ'}
            {details.cart && ' · 台車を つかっているよ'}
        </p>
        {eventMessage(event,resident.id) && <p className="town-recent-event">{eventMessage(event,resident.id)}</p>}
        <div className="town-actions">
            <button onClick={() => onFocus(resident.position)}><MapPin size={16}/>本人のところ</button>
            {home && <button onClick={() => onFocus(home.position)}><Home size={16}/>家のところ</button>}
            {details.destination && <button onClick={() => onFocus(details.destination!)}><Route size={16}/>{details.destinationName}のところ</button>}
        </div>
    </section>;
}
