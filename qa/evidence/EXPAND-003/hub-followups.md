# Hubへの具体的な引継ぎ

SansuからHub共通ソース・他repo・保存先ファイルを変更していない。Hub担当が接続した案件別loader/APIを、通常のUI経由で使用した。下記は共通改修の材料であり、Sansuの保存が未接続という残件ではない。

## 長い仕事名を持つ資料の320幅

site3.2.0のR.docはbrief-factsに関連仕事chipを表示する。日本語の長い仕事名へ言い換えると、brief-mainのmin-width:autoとnowrap chipによって、viewport320/client305の資料がscrollWidth355になった。最初の画像はconstitution-320-overflow.png、実測はbrowser-width-first-failure.json。Sansu固有CSSでarticle>brief内のbrief-main/brief-facts/ddへmin-width:0、chipへwhite-space:normal/max-width:100%/overflow-wrap:anywhereを適用した。固定vendorは不変。共通への差分案もこの範囲へ限定し、PC/390/320の長い日本語名・見直し状態・表を同じ入力で確認する。

## R.wrapと既存ページの実装境界

R.wrapはmainのID aliasを保持するが、class/data属性や、除外した旧integration依存の初期化順は固有側で保持する必要がある。Sansuでは通常ページを同じDOMへ統合し、旧classを保持、旧data-searchをdata-sansu-searchへ値不変で名前空間化、旧readerの自己script参照を実ファイル名へ修正した。旧reader/元データdialogだけを旧CSSのscopeへ入れ、共通メニュー/相談dialogへ旧CSSを掛けない。検索dataとreaderを元のdefer順で初期化する。再現エラーはbrowser-first-errors.json、条件検索は原文/元データを含む82,558項目（完了後の最終正本）を維持する。

共通APIを増やす場合の具体案は、wrapのmainAttrs保持、明示的なlegacyScripts/legacyDialogsの入口、固有CSS scopeの境界。既存の固定版を書き換えず新しい版で提供する。通常ページをiframeへ包む代替にしない。

## 最終registryの圧縮と派生adapter

最初の切戻しでは旧生成のsearch-data.jsとmanifestだけが不一致になった。圧縮payloadに前回portal/index.htmlのhashが1件残り、最終registryには無かった（search-data-self-input.json）。Sansuのcompose順では、共通UIの生成先除外より前に検索データを圧縮していた。最終の同じregistryから検索payloadを再圧縮し、全フィールドの等価を検査することで修正。検索項目や未知フィールドを削減していない。

またproject.jsonは正本から生成するadapterなので、古いdisk bytesを入力hashにするのをやめ、同じ投影textのhashを記録した。registryの本文/資料にproject.jsonの旧内容を取り込んでいないことも確認。verifyは書込せず、初回生成・切戻し・復帰を各1回のbuild/verifyで受け入れる。共通化する場合は「正本投影→registry最終化→検索payload→出力manifest」の順を契約化する。2回buildを初回合格にしない。

## 保存・閉じた仕事

固有loaderはTASKSの表とDONEに明記された仕事参照だけを読み、activeフォルダ全件を仕事に数えない。完全refはsansu:work/2026-10-18-development-portal。完了後も同じID/原文Status/内容版で参照できる。Hub保存は旧版の見直し、別タブ競合、根拠変更時の拒否と入力保持、明示再読込/取消、現在版への再保存・再表示を実操作で確認した。技術完了を人の採用・児童の価値へ昇格しない。
