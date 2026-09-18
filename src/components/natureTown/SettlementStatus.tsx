import { settlementReadiness } from '../../domain/natureTown/life';
import type { EngineContext, WorldState } from '../../domain/natureTown/types';
export function SettlementStatus({world,hubId,ctx}:{world:WorldState;hubId:string;ctx:EngineContext}) {
    const status=settlementReadiness(world,hubId,ctx);
    const full=world.residents.length>=ctx.config.scope.prototypePopulationCap;
    const message=full?'この試作で すめる9人が そろったよ。':!status.homes.length?'食たくに つながる 空いている家を おこう。':!status.historyReady?'ここでの くらしを しばらく ながめよう。':!status.serviceReady?'家へ とどく道と 食べものを たしかめよう。':!status.supplyReady||!status.reserveReady?'畑から 食べものを とどけよう。':'すんでみたい 旅人が くることも あるよ。';
    return <div className="town-settlement-status" data-settlement-ready={status.eligible}>
        <p>{status.population?`この食たくで ${status.population}人の くらし`:'ここは まだ だれも すんでいないよ'}</p>
        <p>{message}</p>
    </div>;
}
