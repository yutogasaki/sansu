import { confirmedKokugoLevel } from '../../domain/kokugo/levels';
import { kokugoUnit } from '../../domain/kokugo/curriculum';
import { kokugoUnitLevel, KOKUGO_LEVEL_TITLES } from '../../domain/kokugo/progressView';
import { useKokugoOverview } from './useKokugoOverview';

export function KokugoLevelSummary({ profileId, easy = false, compact = false, brief = false }: { profileId?: string; easy?: boolean; compact?: boolean; brief?: boolean }) {
    const data = useKokugoOverview(profileId);
    const t = (simple: string, normal: string) => easy ? simple : normal;
    if (!data) return <p role="status">{t('こくごの きろくを よんでいるよ…', '国語の記録を読みこんでいるよ…')}</p>;
    if (data.error) return <p role="alert">{t('こくごの きろくを よめなかったよ。ひらきなおしてね。', '国語の記録を読みこめませんでした。開き直してください。')}</p>;
    const level = confirmedKokugoLevel(data.progress);
    const selected = data.course && kokugoUnitLevel(data.course.unitId);
    const title = data.course ? kokugoUnit(data.course.unitId).title : t('これから えらべるよ', 'これから選べます');
    if (brief) return <div className="kokugo-brief" aria-label={t('こくごの すすみぐあい', '国語の進みぐあい')}><p>{t('いまの ないよう', '取り組む内容')}：{selected ? `Lv${selected} · ` : ''}{title}</p><p className="text-sm text-pokomoko-muted">{t('たしかめた レベル', '確認できたレベル')}：{level ? `Lv${level}` : t('これから', 'まだ確認していません')}</p></div>;
    if (compact) return <div className="kokugo-range" aria-label="国語の進みぐあい"><span>国語{selected ? ` · 取り組む内容 Lv${selected}` : ' · 取り組む内容'}</span><strong>{title}</strong><span>確認できたレベル：{level ? `Lv${level}` : 'まだ確認していません'}</span></div>;
    return <section className="kokugo-level-summary progress-kokugo" aria-label={t('こくごの すすみぐあい', '国語の進みぐあい')}>
        <p className="progress-subject">{t('こくご', '国語')}</p>
        <div className="progress-current"><div><p className="progress-current-label">{t('とりくむ ないよう', '取り組む内容')}</p>
            <h3 className="progress-level-title">{selected ? `Lv${selected} · ` : ''}{title}</h3></div></div>
        <p>{t('たしかめた レベル', '確認できたレベル')}：{level ? `Lv${level} · ${KOKUGO_LEVEL_TITLES[level - 1]}` : t('これから', 'まだ確認していません')}</p>
        {!compact && <p className="text-sm text-pokomoko-muted">{t('すきな ないようから えらべるよ。', '学年をこえて、好きな内容から選べます。')}</p>}
    </section>;
}
