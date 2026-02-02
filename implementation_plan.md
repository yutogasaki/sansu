# 修正計画：レイアウト調整とデバッグ表示削除

## 1. 目的
ユーザーからの指摘に基づき、以下の2点を修正する。
1.  **テンキーの高さ調整**: 画面（ビューポート）に合わせてレスポンシブにサイズが変わるようにしつつ、問題表示エリアを圧迫しないよう、テンキーの高さを必要最小限に抑える。
2.  **不要なデバッグ表示の削除**: 画面左上（ヘッダー下）に出ている `div_rem_q1` などのID表示を削除する。

## 2. 変更内容

### 修正対象ファイル: `src/pages/StudyLayout.tsx`

#### A. デバッグ表示の削除
`Header` コンポーネントに渡している `subtitle` プロパティを削除する。

```tsx
// Before
<Header
    title={currentProblem.subject === 'math' ? 'さんすう' : 'えいご'}
    subtitle={showDebugSubtitle ? currentProblem.categoryId : undefined} // ここ削除
    onBack={() => onNavigate("/")}
    ...
/>

// After
<Header
    title={currentProblem.subject === 'math' ? 'さんすう' : 'えいご'}
    // subtitle削除
    onBack={() => onNavigate("/")}
    ...
/>
```

#### B. レイアウト調整 (Controlsエリア)
`debug-controls` のクラス定義を変更し、高さを抑える。

- **変更前**: `h-[40vh] mobile:h-[45vh]`
  - 高すぎて問題エリアを圧迫していた。
- **変更後**: `h-[34vh] min-h-[220px]`
  - 画面の約1/3の高さに設定（34vh）。
  - 4行レイアウトになったため、以前より高さが不要になっている。
  - これにより、問題エリア（Card）に `66vh - ヘッダー分` のスペースが確保される。

```tsx
<div
    id="debug-controls"
    className="bg-slate-100 p-2 pb-6 ... flex-none h-[34vh] min-h-[220px] ... "
>
```

これで「決定キーは普通サイズ」「キーボードは邪魔にならない高さ」「問題エリアは広い」状態になる。
