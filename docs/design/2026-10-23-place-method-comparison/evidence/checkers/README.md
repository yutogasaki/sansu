# 証拠の再照合

`/private/tmp` で実行した3本をbyte同一で保存した。`copied-checkers-sha256.json` のhashは元ファイルと一致し、既存の各check JSONにあるchecker hashとも一致する。旧JSONは変更していない。

| 保存スクリプト | 元の結果 |
| --- | --- |
| sansu-frozen-browser-pair-check.py | ../frozen-browser-pair-check.json（74/75） |
| sansu-edge-browser-pair-check.py | ../edge-browser-pair-check.json（79/80） |
| sansu-final-ui-check.py | ../final-ui-check.json（81） |
| ordinary-final-restoration-check.py | ../ordinary-final-restoration-check.json（53/76/83、新規） |
| post-edit-life-check.py | ../post-edit-life-check.json（81/82 domain受理・85新規session） |
| final-continuity-check.py | ../final-continuity-check.json（85/86同session編集復元） |

リポジトリrootから次を実行できる。`reproduce.py` は証拠rootの古い絶対パスだけをメモリ内で現在の場所へ置き換え、出力を指定先へ転送する。保存スクリプト・元capture・既存結果は書き換えない。

```sh
python3 docs/design/2026-10-23-place-method-comparison/evidence/checkers/reproduce.py sansu-final-ui-check.py --out /private/tmp/sansu-audit-reproduction
```

第1引数を表の別スクリプト名に変えて各照合を再現する。実行日時は変わるため、JSON全体のbyte一致は期待せず、判定・比較項目・元capture hashを確認する。保存スクリプトを直接実行すると元の結果JSONへ書くため、既存証拠の保全にはこのwrapperを使う。
