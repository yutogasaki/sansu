export type FireflyFlowerSceneStage =
    | "waiting"
    | "dew-trail"
    | "warm-bud"
    | "ringing-petals"
    | "light-path";

export const FIREFLY_FLOWER_CAMERA_KEY = "firefly-flower-side-v4";
export const FIREFLY_FLOWER_WORLD_CANDIDATE_ID = "firefly-carry-bloom-painted-v4";
export const FIREFLY_FLOWER_FIELD_BOOK_CANDIDATE_ID = "firefly-field-book-painted-v4";
export const FIREFLY_FLOWER_Q7_CANDIDATE_ID = "firefly-q7-carry-bloom-v4";

export const FIREFLY_FLOWER_SCENES: Record<FireflyFlowerSceneStage, {
    src: string;
    description: string;
}> = {
    waiting: {
        src: "/assets/explore/firefly-flower/scene-waiting-carry-bloom-pokko-v4.jpg",
        description: "葉帽子のポッコが、一本の浅い溝に集まった四つのしずくと、大きな閉じた花を見ている。",
    },
    "dew-trail": {
        src: "/assets/explore/firefly-flower/scene-dew-trail-carry-bloom-pokko-v4.jpg",
        description: "ポッコが葉帽子に四つのしずくをのせ、閉じた花へ一歩ずつ運んでいる。",
    },
    "warm-bud": {
        src: "/assets/explore/firefly-flower/scene-warm-bud-carry-bloom-pokko-v4.jpg",
        description: "小さなでこぼこで葉帽子が傾き、四つのしずくがこぼれそうに揺れている。",
    },
    "ringing-petals": {
        src: "/assets/explore/firefly-flower/scene-ringing-petals-carry-bloom-pokko-v4.jpg",
        description: "ポッコが柔らかい地面へ尻もちをつき、こぼれた四つのしずくで五枚の花びらが開く。",
    },
    "light-path": {
        src: "/assets/explore/firefly-flower/scene-light-path-carry-bloom-pokko-v4.jpg",
        description: "三つのしずくが溝に並び、跳ね返った最後の一滴が葉帽子に乗り、帽子のふちが片目へかぶさったポッコが安全に座っている。",
    },
};
