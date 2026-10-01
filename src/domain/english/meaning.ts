import type { EnglishWord } from './types';

/** Conservative exclusions: these meanings cannot be safely contrasted in a translation choice. */
const overlappingItems: readonly (readonly string[])[] = [
    ['way_lv12', 'method'], ['hard', 'difficult'], ['road', 'way'],
    ['pretty', 'cute'], ['smart', 'clever'], ['glad', 'happy'],
    ['fast', 'quick'], ['quickly', 'rapidly'], ['slowly', 'gradually'],
    ['wonderful', 'great', 'excellent'], ['nice', 'good'],
    ['tiny', 'small'], ['big', 'large', 'huge', 'enormous'],
    ['angry', 'mad'], ['nearly', 'almost'], ['usually', 'normally'],
    ['generally', 'in general'], ['especially', 'particularly'],
    ['finally', 'eventually'], ['certainly', 'surely', 'definitely'],
    ['obvious', 'clear', 'apparent'], ['clearly', 'evidently', 'obviously'],
    ['issue', 'problem', 'matter'], ['possibility', 'chance'],
    ['obtain', 'get', 'acquire'], ['possess', 'own'],
    ['examine', 'check', 'investigate'], ['construct', 'build'],
    ['create', 'make', 'produce'], ['restore', 'recover'],
    ['permit', 'allow'], ['demand', 'require'], ['refuse', 'reject'],
    ['provide', 'supply', 'offer'], ['reduce', 'decrease'],
    ['increase', 'expand'], ['limit', 'restrict'],
    ['recognize', 'identify'], ['understand', 'comprehend'],
    ['describe', 'explain'], ['show', 'demonstrate', 'indicate'],
    ['preserve', 'conserve', 'protect'], ['ensure', 'guarantee'],
    ['fear', 'anxiety'], ['proud', 'pride'], ['grateful', 'thankful'],
    ['alternative', 'other'], ['adequate', 'sufficient', 'enough'],
    ['many', 'much', 'numerous'], ['all', 'every', 'whole', 'entire', 'total'],
    ['properly', 'properly_lv18'],
];

const equivalentLabels: readonly (readonly string[])[] = [
    ['ほうほう', 'やりかた', '方法', 'やり方'],
    ['じょうきょう', 'じょうたい', '状況', '状態'],
    ['たしか', 'たしかな', '確か', '確かな'],
    ['すぐに', 'ただちに', '直ちに'],
    ['すばらしい', 'すぐれた', '素晴らしい', '優れた'],
    ['ふつう', 'つうじょう', '普通', '通常'],
    ['ほぼ', 'ほとんど'], ['おそらく', 'たぶん', '恐らく'],
    ['ゆるす', 'きょかする', '許す', '許可する'],
    ['しめす', 'みせる', '示す', '見せる'],
];

const normalize = (label: string) => label.normalize('NFKC').replace(/[\s〜～]/g, '');
const labelsFor = (word: EnglishWord) => [word.japanese, word.japaneseKanji].filter((x): x is string => Boolean(x)).map(normalize);

export function vocabMeaningsOverlap(a: EnglishWord, b: EnglishWord): boolean {
    if ((a.surface ?? a.id) === (b.surface ?? b.id)) return true;
    if (overlappingItems.some(group => group.includes(a.id) && group.includes(b.id))) return true;
    const al = labelsFor(a), bl = labelsFor(b);
    if (al.some(label => bl.includes(label))) return true;
    return equivalentLabels.some(group => {
        const labels = group.map(normalize);
        return al.some(label => labels.includes(label)) && bl.some(label => labels.includes(label));
    });
}

/** A repeated saved item need not mean a new lexical sense. This is inventory only. */
export const vocabularySenseId = (word: EnglishWord): string => word.id === 'properly_lv18' ? 'properly' : word.id;
