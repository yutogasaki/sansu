import { useEffect, useState } from 'react';
import { ArrowRight, BookImage, Check, Eye, Flag, Footprints, Leaf, Music2, PawPrint, RotateCcw, Shirt, Sparkles, Star, X } from 'lucide-react';
import { getIslandCustomization } from '../../domain/island/customization';
import { getIslandExperience, type IslandResidentId } from '../../domain/island/experience';
import { isIslandHabitatUnlocked } from '../../domain/island/growth';
import { getIslandExpression, getIslandExpressionEligibility, ISLAND_DAY_PERIODS, ISLAND_EXPRESSION_CATALOG, ISLAND_SEASONS,
    type IslandDayPeriod, type IslandExpressionAction, type IslandExpressionCatalogItem, type IslandExpressionEquipAction,
    type IslandExpressionItemId, type IslandExpressionRequirement, type IslandExpressionSelection, type IslandSeason } from '../../domain/island/expression';
import type { IslandRecord } from '../../domain/island/types';
import type { IslandPhotoMetadata } from '../../domain/island/photos';
import { IslandPhotoAlbumPreview } from './IslandPhotos';
import { IslandRewardGoalChoice, IslandRewardGoalFeedback, type IslandRewardGoalControls } from './IslandRewardGoal';
import type { IslandAmbienceStatus } from './useIslandAmbience';
import './IslandExpression.css';
import './IslandPanel.css';

type Category = 'friends' | 'world' | 'memories';
const categoryOf = (item: IslandExpressionCatalogItem): Category => ['outfit', 'pattern', 'trail'].includes(item.slot) ? 'friends'
    : item.slot === 'soundscape' ? 'world' : 'memories';
const icons = { outfit: Shirt, pattern: Sparkles, trail: Footprints, soundscape: Music2, 'album-cover': BookImage, 'album-stamp': Leaf, 'flag-trim': Flag };
const periodNames: Record<IslandDayPeriod, string> = { morning: 'あさ', day: 'ひる', evening: 'ゆうがた' };
const seasonNames: Record<IslandSeason, string> = { spring: 'はる', summer: 'なつ', autumn: 'あき', winter: 'ふゆ' };
const requirementNames: Record<IslandExpressionRequirement, string> = {
    'ribbon-butterfly': 'ちょうを みつけると もらえるよ。', bell: 'こうさくで ベルが なるところを みると もらえるよ。',
    'leaf-bird': 'はっぱの ことりを みつけると もらえるよ。',
};

function expressionEquipAction(item: IslandExpressionCatalogItem, residentId: IslandResidentId, remove = false): IslandExpressionEquipAction {
    switch (item.slot) {
        case 'outfit': return { type: 'equip-outfit', residentId, itemId: remove ? null : item.itemId };
        case 'pattern': return { type: 'equip-pattern', residentId, itemId: remove ? null : item.itemId };
        case 'trail': return { type: 'equip-trail', residentId, itemId: remove ? null : item.itemId };
        case 'soundscape': return { type: 'equip-soundscape', itemId: remove ? null : item.itemId };
        case 'album-cover': return { type: 'equip-album-cover', itemId: remove ? null : item.itemId };
        case 'album-stamp': return { type: 'equip-album-stamp', itemId: remove ? null : item.itemId };
        case 'flag-trim': return { type: 'equip-flag-trim', itemId: remove ? null : item.itemId };
    }
}
function isEquipped(item: IslandExpressionCatalogItem, resident: IslandResidentId, selection: IslandExpressionSelection) {
    switch (item.slot) {
        case 'outfit': case 'pattern': case 'trail': return selection.residents[resident][item.slot] === item.itemId;
        case 'soundscape': return selection.soundscape === item.itemId;
        case 'album-cover': return selection.album.cover === item.itemId;
        case 'album-stamp': return selection.album.stamp === item.itemId;
        case 'flag-trim': return selection.flagTrim === item.itemId;
    }
}
export interface IslandExpressionProps {
    initialItemId?: IslandExpressionItemId; rewardGoal?: IslandRewardGoalControls;
    island: IslandRecord; disabled: boolean; pending: boolean; previewAction?: IslandExpressionEquipAction; error?: string;
    previewSelection: IslandExpressionSelection; photo?: IslandPhotoMetadata;
    soundEnabled: boolean; soundStatus: IslandAmbienceStatus;
    onAction: (action: IslandExpressionAction) => Promise<boolean>;
    onPreview: (action: IslandExpressionEquipAction | undefined) => void;
    onFocusResident: (id: IslandResidentId | undefined) => void;
    onFocusFlag?: (focused: boolean) => void;
    onVisit: (requirement: IslandExpressionRequirement) => void;
    onRetry?: () => void; onListen: () => void; onClose: () => void; onLearn: () => void; onSaveScene: () => void;
}

/** Selection, free preview, acquisition and equipping are separate visible steps. */
export function IslandExpression({ island, disabled, pending, previewAction, previewSelection, photo, soundEnabled, soundStatus, error, onAction, onPreview, onFocusResident, onFocusFlag,
    onVisit, onRetry, onListen, onClose, onLearn, onSaveScene, initialItemId = 'raincoat', rewardGoal }: IslandExpressionProps) {
    const initialItem = ISLAND_EXPRESSION_CATALOG.find(item => item.itemId === initialItemId)!;
    const [category, setCategory] = useState<Category>(categoryOf(initialItem));
    const [itemId, setItemId] = useState<IslandExpressionItemId>(initialItemId);
    const [resident, setResident] = useState<IslandResidentId>('otter');
    const [flagOverview, setFlagOverview] = useState(false);
    const expression = getIslandExpression(island), experience = getIslandExperience(island), points = getIslandCustomization(island).points;
    const residents: IslandResidentId[] = island.completedSets >= 4 && isIslandHabitatUnlocked(island, 'waterside')
        ? ['otter', 'rabbit', 'fox'] : ['otter', 'rabbit'];
    const selectedResident = residents.includes(resident) ? resident : 'otter';
    const items = ISLAND_EXPRESSION_CATALOG.filter(item => categoryOf(item) === category);
    const selected = items.find(item => item.itemId === itemId) ?? items[0];
    const owned = expression.ownedItemIds.includes(selected.itemId), equipped = isEquipped(selected, selectedResident, expression.selection);
    const eligibility = getIslandExpressionEligibility(island, selected.itemId), busy = disabled || pending;
    useEffect(() => { onFocusResident(category === 'friends' ? selectedResident : undefined); }, [category, selectedResident, onFocusResident]);
    useEffect(() => {
        onFocusFlag?.(selected.slot === 'flag-trim' && !flagOverview);
        return () => onFocusFlag?.(false);
    }, [selected.slot, flagOverview, onFocusFlag]);
    const tabs = [{ id: 'friends', name: 'なかま', Icon: PawPrint }, { id: 'world', name: 'けしきと おと', Icon: Music2 },
        { id: 'memories', name: 'おもいで', Icon: BookImage }] as const;
    return <section className="island-sheet island-panel island-expression" aria-label="みじたくと コレクション" data-expression-tab={category}
        data-expression-item={selected.itemId} data-expression-resident={selectedResident}>
        <div className="island-sheet-title"><h2>みじたくと コレクション</h2>
            <button className="island-icon-button island-panel-back" aria-label="みじたくを とじる" disabled={disabled} onClick={onClose}><X size={20} /><span>もどる</span></button></div>
        <div className="island-expression-tabs island-panel-choices" role="group" aria-label="かえたい もの">{tabs.map(({ id, name, Icon }) => <button key={id}
            className="island-secondary" disabled={busy} aria-pressed={category === id} onClick={() => { onPreview(undefined); setCategory(id); setFlagOverview(false); }}>
            <Icon size={17} aria-hidden="true" />{name}</button>)}</div>
        <p className="island-expression-wallet"><Star size={18} aria-hidden="true" /><strong>{points}</strong>ほし</p>
        {category === 'memories' && selected.slot !== 'flag-trim' && <IslandPhotoAlbumPreview photo={photo} decoration={previewSelection.album} />}
        {category === 'friends' && <div className="island-expression-residents island-panel-choices" role="group" aria-label="なかまを えらぶ">{residents.map(id => <button key={id}
            className="island-secondary" disabled={busy} aria-pressed={selectedResident === id} data-expression-resident-choice={id}
            onClick={() => { onPreview(undefined); setResident(id); }}>{experience.residents[id].name}</button>)}</div>}
        <div className="island-expression-catalog island-panel-choices">{items.map(item => {
            const Icon = icons[item.slot], has = expression.ownedItemIds.includes(item.itemId);
            return <button key={item.itemId} className="island-expression-card" disabled={busy} aria-pressed={selected.itemId === item.itemId}
                data-expression-choice={item.itemId} onClick={() => { onPreview(undefined); setItemId(item.itemId); setFlagOverview(false); }}>
                <Icon size={28} aria-hidden="true" /><strong>{item.name}</strong>
                <small>{has ? <><Check size={13} />もっている</> : item.price ? `${item.price} ほし` : 'みつけた しるし'}</small></button>;
        })}</div>
        <div className="island-expression-detail"><h3>{selected.name}</h3><p>{selected.description}</p>
            {rewardGoal && <IslandRewardGoalChoice island={island} target={{ category: 'expression', itemId: selected.itemId }} disabled={busy} controls={rewardGoal} />}
            <IslandRewardGoalFeedback controls={rewardGoal} disabled={disabled} />
            {selected.slot === 'flag-trim' && <button className="island-secondary" disabled={disabled} data-expression-action="flag-view"
                aria-pressed={!flagOverview} onClick={() => setFlagOverview(value => !value)}>
                <Flag size={18} aria-hidden="true" />{flagOverview ? 'はたを みる' : 'しま全体を みる'}</button>}
            <button className="island-secondary" disabled={busy} data-expression-action="preview"
                onClick={() => onPreview(expressionEquipAction(selected, selectedResident))}><Eye size={18} />むりょうで ためす</button>
            {previewAction && <div className="island-expression-preview" role="status"><span>おためし</span>
                <button className="island-text-button" disabled={disabled} onClick={() => onPreview(undefined)}><RotateCcw size={15} />いまに もどす</button>
                {previewAction.type === 'equip-soundscape' && <div data-expression-sound={soundStatus}>
                    <button className="island-secondary" disabled={disabled || !soundEnabled} onClick={onListen}><Music2 size={17} />おとを きく</button>
                    {!soundEnabled && <p>おとを きくときは、うえの おとを つけてね。</p>}
                    {soundEnabled && soundStatus === 'blocked' && <p>もういちど おして きいてみよう。</p>}</div>}</div>}
            {owned ? <div className="island-expression-use">
                <button className="island-primary" disabled={busy || equipped} data-expression-action="equip"
                    onClick={() => { void onAction(expressionEquipAction(selected, selectedResident)); }}><Check size={18} />{equipped ? 'いま つかっている' : category === 'friends' ? 'このこに つける' : 'これを つかう'}</button>
                {equipped && <button className="island-text-button" disabled={busy} data-expression-action="remove"
                    onClick={() => { void onAction(expressionEquipAction(selected, selectedResident, true)); }}>はずす</button>}
            </div> : <div className="island-expression-acquire">
                {!eligibility.eligible && selected.requirement && <p>{requirementNames[selected.requirement]}<button className="island-text-button"
                    disabled={disabled} onClick={() => selected.requirement === 'bell' && island.completedSets < 1 ? onLearn() : onVisit(selected.requirement!)}>
                    {selected.requirement === 'bell' && island.completedSets < 1 ? 'まなんで いりえを ひらく' : 'みに いく'} <ArrowRight size={15} /></button></p>}
                {points < selected.price && <p>あと {selected.price - points} ほし</p>}
                <button className="island-primary" disabled={busy || !eligibility.eligible || points < selected.price} data-expression-action="acquire"
                    onClick={() => { void onAction({ type: 'acquire', itemId: selected.itemId }); }}><Star size={18} />{selected.price ? `${selected.price}ほしで もらう` : 'みつけた しるしを もらう'}</button>
                <small>もらった あと、つかう ものを えらべるよ。</small>
            </div>}
        </div>
        {category === 'world' && <div className="island-expression-free"><p>けしきは いつでも むりょうで えらべるよ。</p>
            <fieldset><legend>そらの じかん</legend><div className="island-panel-choices">{([null, ...ISLAND_DAY_PERIODS] as const).map(period => <button key={period ?? 'default'} className="island-secondary"
                disabled={busy} aria-pressed={previewSelection.environment.period === period} data-expression-period={period ?? 'default'}
                onClick={() => onPreview({ type: 'period', period })}>{period ? periodNames[period] : 'いつもの'}</button>)}</div>
                {previewAction?.type === 'period' && <p className="island-panel-environment-status" role="status">おためし：{previewSelection.environment.period ? periodNames[previewSelection.environment.period] : 'いつもの'}
                    <br />いまの しま：{expression.selection.environment.period ? periodNames[expression.selection.environment.period] : 'いつもの'}</p>}</fieldset>
            <fieldset><legend>きせつ</legend><div className="island-panel-choices">{([null, ...ISLAND_SEASONS] as const).map(season => <button key={season ?? 'default'} className="island-secondary"
                disabled={busy} aria-pressed={previewSelection.environment.season === season} data-expression-season={season ?? 'default'}
                onClick={() => onPreview({ type: 'season', season })}>{season ? seasonNames[season] : 'いつもの'}</button>)}</div>
                {previewAction?.type === 'season' && <p className="island-panel-environment-status" role="status">おためし：{previewSelection.environment.season ? seasonNames[previewSelection.environment.season] : 'いつもの'}
                    <br />いまの しま：{expression.selection.environment.season ? seasonNames[expression.selection.environment.season] : 'いつもの'}</p>}</fieldset>
            {previewAction && ['period', 'season'].includes(previewAction.type) && <button className="island-primary" disabled={busy}
                data-expression-action="apply-free" onClick={() => { void onAction(previewAction); }}>この けしきに する</button>}
        </div>}
        {error && <div className="island-error" role="alert"><p>{error}</p>{onRetry && <button className="island-secondary" disabled={disabled} onClick={onRetry}>きろくを たしかめる</button>}</div>}
        <div className="island-expression-footer island-panel-footer"><button className="island-text-button" disabled={disabled || Boolean(previewAction)} onClick={onSaveScene}>けしきを のこす</button>
            <button className="island-secondary" data-expression-action="learn" disabled={disabled} onClick={onLearn}>まなぶ <ArrowRight size={18} /></button></div>
    </section>;
}
