# mainコミット候補の独立検証

共有作業の変更を除外した候補。基準コミット `f44f04fefc65893a66f96fd833729bc9e3969693`、検証対象tree `04f38c2b7b4ef20e34165628be69c05aa06feaaa`（この証拠追加前）。app入力は以後変更なし。

対象 http://127.0.0.1:5220 / DEV + VITE_HOME_JOURNEY_PREVIEW=true、候補 home-journey-connected-house-v7。

型検査・build・資料検査・lint（既存warning1）・全316ファイル3438テスト通過。スマホ390×844/タブレット768×1024 reduced motionの通常学習45問、同一家の室内・実写真・学習予約再開が通過。[実操作結果](report.json)、[実画面一覧](review.html)。

親ディレクトリの証拠は先行する共有作業snapshot。本候補には他タスクの室内チャレンジや操作改修を含めない。classic smoke31項目は先行snapshotのみの証拠。

視覚HOLD、子どもの独立検証N=0。DEV経路は通過、本番公開・移行・PWAは未承認。
