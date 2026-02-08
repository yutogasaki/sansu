export type IkimonoStage =
    | 'egg'       // 生まれる前
    | 'hatching'  // 生まれそう
    | 'small'     // 生体（小）
    | 'medium'    // 生体（中）
    | 'adult'     // 生体（成体）
    | 'fading'    // さよなら（フェードアウト中）
    | 'gone';     // 完全に去った → 次のライフサイクルへ

export interface IkimonoState {
    profileId: string;
    birthDate: string;   // ISO timestamp
    generation: number;  // ライフサイクル回数（1, 2, 3...）
}
