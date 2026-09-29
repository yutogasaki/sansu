# ADR: 北極星を「育つ島」に改める

- Date: 2026-09-29
- Status: Accepted
- Related spec: [CONSTITUTION](../../CONSTITUTION.md), [01 アプリ仕様](../product/01_app_spec.md), [51 幻想の暮らし](../product/51_living_fantasy_island_spec.md), [自然と町の統合方針](../product/island-nature-integration.md), [Nature Town 01](../product/nature-town/01_PRODUCT_AND_DECISIONS.md)
- Related task: [現在のタスク](../../.agents/tasks/TASKS.md)

## Context

2026-09-29時点で、CONSTITUTION §1の北極星は2026-07の旧Explore（「相棒ポッコと明るい地底世界を探検し、算数で掘り進む」）のままだった。§3.1（算数は岩を割る等の世界での行動）、§3.3・§4（ラン中の選択・ランの物語）、§5（正本3位が旧Exploreの仕様10）も旧モード前提で、最新の方向は冒頭に積み重なった日付付きの上書き5件にしかなかった。

エージェントはCONSTITUTIONから読むため、北極星が空白のまま新しい仕様を書くたびに、その時の参考資料が方向を決めていた。2026-07-23〜09-27の約2か月で方向は8回変わった（Explore→遊園地→ぴったり連鎖→Mystic Island 28→暮らす島48→Nature Town→統合→幻想の暮らし51）。

その結果、仕様51はNature Townの芯（D03 繁栄・人口増加、D04 条件付き確率）を明示の承認なく書き換えた。住人の上限3人、発見はすべて決定的、土地は面積だけ、学習はしずくの発行だけ。試算では、新規購入品と土地は約108問の有効完了で買い尽くせ、以後は学習と島の因果が弱まる。ユーザーは2026-09-29に「住人３人にするつもりない」と明言し、北極星が古いことを「完全におかしい」と判断した。

## Decision

ユーザーが2026-09-29に次を選択した。

1. **北極星は「育つ島」**。ぽこもこと自分の島を育て、置き方で水・食べ物・人の流れが変わり、住人が増え、島が広がり、ときどきその場所だけの不思議が起きる。面白さの源は「くふう・にぎわい・ふしぎ」の三つで、土台に「愛着」を置く。Nature Townの三軸を今の島・ぽこもこ・家の上で実現する。51は表現（美術・光・画面）と発見の層として使う。
2. **学習は材料と道具の両方をもたらす**。しずく（材料）に加え、学習で開く道具（例: 台車）が島の遊び方を変える。外からの報酬であることを正直に扱い、学習画面自体の気持ちよさで補う。
3. **人口は地区ごとに増やす**。固定の小さな上限で止めない。土地・地区が広がるほど迎えられる人数が増える。性能予算（遠景の簡略表示など）とあわせて設計する。
4. **住人を増やすための新しい動物デザインを作ってよい**。ぽこもこの既存デザインは変えない。

あわせてCONSTITUTIONを北極星中心に書き直し、日付付きの上書きはこのADRへ移した。柱を削る仕様変更や北極星の変更は、ユーザーの明示承認とADRを必要とする。

### 追記（同日）：学習との関係を具体化

ユーザーの修正（「島で冒険させるとゲームが中心になる」「置くと自然に育ち、それと学習を関連付けたい」「独自の島になって見せたくなる」「縛られすぎず楽しく」）を受け、決定2の「道具の解放」を、**学ぶと島の時間が進む（まちの時計）**と**単元の独力習得で記念品が届く**に置き換えた。学習の量で抽選の回数は増やさない。遊びの規則は[52 育つ島 ゲーム仕様](../product/52_growing_island_game_spec.md)に確定した（数値は試作で調整）。

## Alternatives Considered

- A. 仕様51の小さな庭の居場所をそのまま北極星にする。長く遊ぶ動機と学習の因果が弱く、ユーザーの意図（人口を増やす）と逆。
- A'. Aに人口だけ足す。繁栄の見せ方・地区・道具の解放が伴わず、住人を増やす理由が弱い。
- C. 算数そのものを世界での行動にする（旧Explore）。7月以降の複数回の作り直しで面白さに届かなかった。旧Exploreモードの契約として残す。
- D. ずかん集めを中心にする。驚きの層としては有効だが単独の背骨には薄い。Bの「ふしぎ」に含める。

## Consequences

### Benefits

- 新しい仕様がどの柱に効き、何を削るかを北極星に照らして判断できる。
- Nature Townの統合と仕様51の食い違いに、決める基準ができる。
- 買い尽くしの問題に対し、人口・地区・道具という長く続く使い道ができる。

### Downsides

- 仕様51の複数章（02 P-06、03 E-02、04 D-01ほか）と48の「新しい人物デザインを追加しない」を改訂する必要がある。
- 3Dの住人を増やすと描画負荷が上がる。2026-09時点でdesktop P95は33.3ms目標に未達。
- 新しい住人の美術制作と、人口規則・保存の設計が必要になる。

### Operational Notes

- この決定は文書の方向を定めるもので、実装・保存形式・公開は変更していない。現在の本番は保存版21のまま。
- 仕様51の改訂が済むまで、51のうち北極星と食い違う規則（住人上限3など）を正として実装しない。食い違いは51冒頭の「北極星との整合」に列挙する。

## Verification

- Checks: `npm run docs:check`
- Manual confirmation: ユーザーが2026-09-29の会話で北極星B・学習は材料と道具・地区ごとの人口・新しい動物デザイン可を選択。

## Follow-ups

- 仕様51を北極星に合わせて改訂する（人口と来訪の規則、条件付き確率の訪問、土地の役割、学習で開く道具、新しい住人）。
- 人口が増える一周を、美術より先に白い試作で確認する。
- 人口と描画の性能予算を決める。
- 01 §2の旧Explore記述を仕様10へ移す。

## 付録: 置き換えた旧CONSTITUTION冒頭と§0〜§1（原文）

以下は2026-09-29の改訂前の原文。各日付の決定のうち、現在も有効な拘束（ぽこもこの姿の維持、Nature Townの統合と両保存の保持、ぴったり連鎖の終了とデータ保持、学習記録と所有の保護）は新しいCONSTITUTIONの本文へ移した。旧Exploreの北極星と設計論は、旧Exploreモードだけに適用する。

> 2026-09-27 — production integration: The user explicitly requested integrating the existing fantasy candidate and Nature Town loop into household production. Keep Pokomoko’s original face, silhouette, proportions, ears, patchwork, colors and appearance choices. This authorizes the scoped release after technical verification; it does not turn unperformed independent art/child/device observations into PASS or declare specification 51 complete. Preserve learning, ownership and both databases; use a version-compatible rollback.
>
> 2026-09-27 — character identity: The user explicitly requires keeping Pokomoko's existing design. Preserve its face, silhouette, proportions, ears, patchwork fabric, palette and existing appearance choices. Reconsidering the world, design or mechanics does not authorize changing Pokomoko. Any proposed character redesign needs a separate explicit request or approval; a concept board is not that approval. The temporary fantasy-companion replacement is withdrawn.
>
> 2026-09-27 — next-design scope: The user authorized reconsidering already specified world design and mechanics and requested a comprehensive specification. [51 Living Fantasy Island](../product/51_living_fantasy_island_spec.md) and its eight chapters define the next `living-fantasy-v1` design, using direction B for the environment. Environment art constraints may change within that target; Pokomoko's existing character identity remains binding. Learning integrity, non-shaming, ownership, and save protection remain binding. The generated concept board is not approved final art. Current-runtime contracts continue until a verified cutover; specification work alone is not implementation, save conversion, or deployment.
>
> 2026-09-27: `ぴったり連鎖` is retired. It was never part of the current app menu; remove its standalone development entry and implementation. Keep its specification and verification as historical records under `docs/product/archive/` and `docs/design/`. Do not treat the 2026-09-06 priority below as current work or delete a child's saved learning data while retiring the prototype.
>
> 2026-09-22: Nature Town is no longer a separate product direction. Integrate its nature, transport, population and land systems into the current Island, retaining the existing art, characters, home and learning flow. Follow `docs/product/island-nature-integration.md`; preserve both existing saves and distinguish adopted integration from implemented migration. Do not continue a separate town art direction or infer permission to overwrite saves or deploy.
>
> 2026-09-10: The user authorized the next island prototype in `docs/product/48_island_life_spec.md`: learning earns creative choices; placement, time and autonomous residents produce different lives. Pokomoko alone receives destination choices. Learning participation, daily achievement and independent mastery remain distinct. The initial DEV prototype uses a separate game database. On 2026-09-11 the user authorized household production use with fresh ownership and no ownership migration; learning records remain intact. Existing modes retain their own progression and saved rights.
>
> ## 0. Purpose
>
> This file defines the highest-priority principles for the `sansu` workspace.
> If documents, implementation, task notes, past logs, or conversational decisions conflict, this file wins.
>
> Sansu / ポッコのふしぎずかん is not only a learning utility. It is a **math game children choose to replay**, where repeated arithmetic practice and retention grow as a consequence of engaging gameplay.
>
> ## 1. Product North Star
>
> The current development priority (2026-09-07) is the user-adopted Mystic Island learning game in `docs/product/28_mystic_island_spec.md`: preserve normal problem inputs and rapid consecutive learning while correct answers restore light and short sections grow a freely arranged island. The prior gameplay-first candidate below remains an independent mode, not a constraint on the new island.
>
> The previous development priority (2026-09-06) was gameplay-first within an explicit learning scope. Its first candidate `ぴったり連鎖` is now retired; see the [historical specification](../product/archive/27_gameplay_first_pittari_spec.md). Exploration and build-and-play contracts below govern their existing modes, not the current Island.
>
> The user-authorized `build-play-v1` MVP also follows `docs/product/22_shared_subject_build_and_play_spec.md`. A fixed companion, exploration, random discovery, eight-question runs, and math as an immediate world action are rules for the existing exploration mode, not universal requirements. The shared game connects reserved learning segments to chosen functional parts; free placement and replay determine the outcome. Assisted completion and independent mastery remain separate. All data-safety, non-shaming, and verification rules apply to both modes.
>
> > ポッコのふしぎずかんは、子どもが相棒ポッコと明るい地底世界を探検し、算数で掘り進み、発見・判断・失敗・再挑戦をくり返すことで、自然に計算練習を続けたくなるPWAである。
>

### 旧§3 設計の芯（旧Explore前提、原文）

>
> ### 3.1 Math is a game action, not a toll
>
> Problems should power actions such as:
>
> - breaking open a rock
> - connecting a bridge
> - activating a terrain switch
> - escaping a risky route
> - opening a chance at a rare discovery
>
> The actions children feel they are performing are **dig, choose, move, return, build, discover, and bring things home**.
>
> ### 3.2 Learning does not shame; the game may fail
>
> The product distinguishes ability judgment from recoverable game consequences.
>
> | Area | Rule |
> |---|---|
> | Deny or belittle a child's ability | Never |
> | Lower learning progress as punishment | Never |
> | Remove a discovery already registered in a collection | Never |
> | Miss a temporary bonus in the current run | Allowed |
> | Take a detour or retry a bridge | Allowed |
> | Lose part of unconfirmed run materials | Allowed when clearly communicated |
> | End a run and offer a quick retry | Allowed |
> | Use a brief, playful failure animation | Encouraged when it invites retry |
>
> ### 3.3 Remove meaningless choices, add meaningful choices
>
> Reduce:
>
> - setup choices before play
> - settings mixed into the child surface
> - choices that require instructions to understand
> - parent information inside the play flow
>
> Add:
>
> - safe path or discovery path
> - continue or return
> - spend or save a bridge resource
> - nearby known find or distant unknown light
> - challenge or detour
>
