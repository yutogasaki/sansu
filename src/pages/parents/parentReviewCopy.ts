export const PARENT_REVIEW_COPY = {
    title: "復習候補",
    description: "5回以上の回答がある項目が対象です。直近10回の正答率が60%未満で候補に加わり、80%以上になると表示から外れます。",
    summary: (count: number) => `復習候補：${count}件`,
    empty: "今は復習候補がありません。",
} as const;
