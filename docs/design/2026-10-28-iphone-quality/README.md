# iPhoneの島を1倍から描画する

2026-10-28。本人からiPhoneの島が粗いと報告され、通常開始1倍・上限1.5倍と負荷時の引き下げ、およびmainへのcommit/pushを依頼された。育てた島を開いた最初の絵を見やすくする変更。基準コミットは `e718c3e3`。

## 変更と境界

Apple判定で選ばれるGrowingの軽量描画をpixelRatio1（端末密度と下位上限以内）から開始する。従来は0.65から開始していた。前景が3秒以上安定したら1.25、1.5へ段階的に上げる。継続的に遅ければ0.8・0.65へ戻し、その画面で失敗した段階へ再昇格しない。初期化失敗・手動再試行などの復旧は0.65から始め、既存の段階昇格を保持する。

通常開始が1になったため、その段階でrender/contextに失敗すると既存のfallbackで上限0.8・初期0.65へ一度だけ自動復旧する。低画質での失敗は失敗画面へ戻す。88%のshader寿命修正は保持する。MSAA・影・モデル・保存・学習・更新保護は変えない。

## 検証

- 画質・renderer・shaderの対象43 tests PASS。開始、端末密度/失敗上限、安定した昇格、負荷降格、再昇格禁止、中断後の観測、復旧の下限を確認。
- 本番設定のbuild/assets・typecheck PASS。初回lintは並行起動したViteの一時configが走査中に消えて失敗したため、build完了後に再検査してPASS（既存warning 5件）。生ログは `output/2026-10-28-iphone-quality/` に残す。
- [実ブラウザー結果](browser-report.json)：WebKit/ChromiumのApple判定・DPR 3・390×844で初回canvasが390px（1倍）、上限1.5。WebKitは実際に1.5まで上昇し、Chromiumでは負荷に応じて0.65へ下がった。更新URLの通常起動、真の不正shaderで上限0.8へ一度だけ復旧、停止、手動再試行0.65と保存学習不変がPASS。
- [通常起動](webkit-normal.png) / [安定後](webkit-settled.png)。実機iPhoneの撮影ではなく、使い捨ての合成本人のproduction browserである。
- 全体unitは689 files / 5,753 tests PASS（834.53秒）。入口guardもPASS。[検証集計](verification-summary.json)。
- classic smokeは31/32。旧Exploreの物理入力で期待12に対して1となる既存箇所が失敗した。同じsource/harnessの対象再実行はPASS。初回ログを保持し、一回の32/32完走とは扱わない。
- コミット対象は別directoryへexportし、製品入力を上記検証へSHA照合する。文書checkerとNode 24での入口/portal生成・検証はこのexportへ適用し、別作業のポータル内容を混ぜない。

端末のGPU時間やメモリ容量を測るロジックではない。全体unitと同時に動かしたbrowser結果をFPSベンチマークにしない。実機の発熱・電池・滑らかさ、子どもの理解/再訪は未確認。

親仕様01、育つ島仕様52、検証matrixを更新。既存の安定性の境界を保持する局所的な画質調整なのでADR・durable memoryは追加しない。開始時からある別作業のポータル変更をコミットに含めない。
