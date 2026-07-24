export type FireflyFlowerSceneStage =
    | "waiting"
    | "dew-trail"
    | "warm-bud"
    | "ringing-petals"
    | "light-path";

export const FIREFLY_FLOWER_CAMERA_KEY = "firefly-flower-side-v5";
export const FIREFLY_FLOWER_WORLD_CANDIDATE_ID = "firefly-stumble-bloom-painted-v5";
export const FIREFLY_FLOWER_FIELD_BOOK_CANDIDATE_ID = "firefly-field-book-painted-v5";
export const FIREFLY_FLOWER_Q7_CANDIDATE_ID = "firefly-q7-stumble-bloom-v5";

export const FIREFLY_FLOWER_SCENES: Record<FireflyFlowerSceneStage, {
    src: string;
    description: string;
}> = {
    waiting: {
        src: "/assets/explore/firefly-flower/scene-waiting-stumble-bloom-pokko-v5.jpg",
        description: "葉帽子のポッコが、一本の道に並ぶ四つのしずくと、大きな閉じた花を見ている。",
    },
    "dew-trail": {
        src: "/assets/explore/firefly-flower/scene-dew-trail-stumble-bloom-pokko-v5.jpg",
        description: "ポッコが葉帽子に四つのしずくをのせ、閉じた花へ一歩ずつ運んでいる。",
    },
    "warm-bud": {
        src: "/assets/explore/firefly-flower/scene-warm-bud-stumble-bloom-pokko-v5.jpg",
        description: "小さなでこぼこへ足が当たり、葉帽子が傾いて、四つのしずくが揺れている。",
    },
    "ringing-petals": {
        src: "/assets/explore/firefly-flower/scene-ringing-petals-stumble-bloom-pokko-v5.jpg",
        description: "ポッコがでこぼこにつまずき、飛んだ四つのしずくで五枚の花びらが開く。",
    },
    "light-path": {
        src: "/assets/explore/firefly-flower/scene-light-path-stumble-bloom-pokko-v5.jpg",
        description: "四つのしずくが開いた花の中心へおさまり、帽子のふちが片目へかぶさったポッコが安全に座っている。",
    },
};
