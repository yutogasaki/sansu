import type {
    DiscoveryPageDefinition,
    DiscoveryPageId,
} from "./discoveryPage";

/**
 * Storage compatibility contract:
 *
 * The page, feature, and chain ID strings below are legacy-stable Jabarapon
 * storage IDs. Existing run events may already contain them, so the visible
 * subject can become Makimodon without rewriting persisted discoveries.
 */
export const MAKIMODON_DISCOVERY_PAGE = {
    id: "discovery-page:jabarapon",
    title: "くるくる もどって、どん。マキモドン！",
    subjectName: "マキモドン",
    features: [
        {
            id: "discovery-feature:jabarapon-two-legs",
            title: "ほどけて、ぺたん。",
            clue: "はしっこが もぞもぞ。",
            finding: "まきまきが ほどけて、ぺたん。",
        },
        {
            id: "discovery-feature:jabarapon-four-legs",
            title: "みちに なった。",
            clue: "まだ つづきが まいてある",
            finding: "ながく ほどけて、みちに なった。",
        },
        {
            id: "discovery-feature:jabarapon-six-legs",
            title: "ぜんぶ まきもどった！",
            clue: "のったら どうなる？",
            finding: "あいぼうが せなかへ どん。",
        },
    ],
    chain: {
        id: "discovery-chain:jabarapon-accordion-legs",
        featureIds: [
            "discovery-feature:jabarapon-two-legs",
            "discovery-feature:jabarapon-four-legs",
            "discovery-feature:jabarapon-six-legs",
        ],
        bigDiscoveryFeatureId: "discovery-feature:jabarapon-six-legs",
    },
} as const satisfies DiscoveryPageDefinition;

/**
 * @deprecated Use MAKIMODON_DISCOVERY_PAGE. This alias exists only so older
 * code can read legacy-stable storage IDs during the visual migration.
 */
export const JABARAPON_DISCOVERY_PAGE = MAKIMODON_DISCOVERY_PAGE;

export const FIREFLY_FLOWER_DISCOVERY_PAGE = {
    id: "discovery-page:firefly-flower",
    title: "ほたる花の ひみつ",
    subjectName: "ほたる花",
    features: [
        {
            id: "discovery-feature:firefly-flower-dew-trail",
            title: "葉帽子の しずく",
            clue: "四つのしずくを 葉帽子へ のせてみよう",
            finding: "葉帽子なら 四つのしずくを いっしょに運べた",
        },
        {
            id: "discovery-feature:firefly-flower-warm-bud",
            title: "葉帽子 ぐらり",
            clue: "しずくを運んで、でこぼこを こえてみよう",
            finding: "一つのでこぼこで、葉帽子が ぐらりと傾いた",
        },
        {
            id: "discovery-feature:firefly-flower-ringing-petals",
            title: "しりもちで ぱっ",
            clue: "でこぼこを越えて、しずくを 花まで運ぼう",
            finding: "ポッコが安全に尻もちをつき、四つのしずくで五枚の花びらが ぱっとひらいた",
        },
        {
            id: "discovery-feature:firefly-flower-light-path",
            title: "はねかえりの 一滴",
            clue: "ひらいた花から、さいごの一滴を 見とどけよう",
            finding: "さいごの一滴だけ跳ね返り、ポッコの葉帽子へ ぽとん",
        },
    ],
    chain: {
        id: "discovery-chain:firefly-flower-secret",
        featureIds: [
            "discovery-feature:firefly-flower-dew-trail",
            "discovery-feature:firefly-flower-warm-bud",
            "discovery-feature:firefly-flower-ringing-petals",
            "discovery-feature:firefly-flower-light-path",
        ],
        bigDiscoveryFeatureId: "discovery-feature:firefly-flower-light-path",
    },
} as const satisfies DiscoveryPageDefinition;

export const DISCOVERY_PAGE_CATALOG: readonly DiscoveryPageDefinition[] = [
    MAKIMODON_DISCOVERY_PAGE,
    FIREFLY_FLOWER_DISCOVERY_PAGE,
];

export const getDiscoveryPageDefinition = (
    pageId: DiscoveryPageId,
): DiscoveryPageDefinition | undefined => (
    DISCOVERY_PAGE_CATALOG.find((definition) => definition.id === pageId)
);
