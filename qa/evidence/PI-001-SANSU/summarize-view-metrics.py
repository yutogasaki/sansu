from pathlib import Path
import collections, datetime, hashlib, json

out = Path(__file__).resolve().parent
path = out / 'library-stable/browser.json'
browser = json.loads(path.read_text())
pairs = collections.defaultdict(dict)
for page in browser['pages']:
    pairs[(page['source'], page['width'])][page['variant']] = page

issues, regressions = [], []
for (source, width), pair in pairs.items():
    before, after = pair['before'], pair['after']
    if after['overflow'] or after['visibleBrokenImages']:
        issues.append({
            'source': source, 'target': after['target'], 'width': width,
            'beforeOverflow': before['overflow'], 'afterOverflow': after['overflow'],
            'beforeVisibleBrokenImages': before['visibleBrokenImages'],
            'afterVisibleBrokenImages': after['visibleBrokenImages'],
            'before': before['screenshots'], 'after': after['screenshots'],
            'verdict': '未受入：既存の横はみ出し/欠損画像を保持した状態。撮影成功を表示合格にしない。'
        })
    if ((after['overflow'] and not before['overflow']) or
            after['visibleBrokenImages'] > before['visibleBrokenImages']):
        regressions.append({'source': source, 'width': width})

result = {
    'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'command': 'python3 qa/evidence/PI-001-SANSU/summarize-view-metrics.py',
    'candidate': browser['candidate'], 'manifestSha256': browser['manifestSha256'],
    'browserEvidenceSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
    'conditionsPerVariant': len(pairs), 'sources': len({p[0] for p in pairs}),
    'overflowConditions': {
        variant: sum(bool(pair[variant]['overflow']) for pair in pairs.values())
        for variant in ('before', 'after')
    },
    'brokenImageConditions': {
        variant: sum(bool(pair[variant]['visibleBrokenImages']) for pair in pairs.values())
        for variant in ('before', 'after')
    },
    'newMetricRegressions': regressions, 'issues': issues,
    'acceptance': 'HOLD：新規悪化0は全画面の表示/操作合格を意味しない。'
}
(out / 'view-metrics.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
with (out / 'view-metrics.md').open('w') as f:
    f.write('# 全308ページの表示計測と未達\n\n' + result['acceptance'] + '\n\n')
    f.write('同内容・同幅の616組。横はみ出しは新旧各42条件、欠損画像は新旧各2条件。対象候補 `' + browser['candidate'] + '`。\n\n')
    f.write('| 元ページ | 幅 | 横はみ出し（旧→新） | 欠損画像数（旧→新） | 比較画像 |\n| --- | --- | --- | --- | --- |\n')
    for item in issues:
        old, new = item['before'][0], item['after'][0]
        f.write('| ' + item['source'] + ' | ' + str(item['width']) + ' | ' +
                str(item['beforeOverflow']) + '→' + str(item['afterOverflow']) + ' | ' +
                str(item['beforeVisibleBrokenImages']) + '→' + str(item['afterVisibleBrokenImages']) +
                ' | [旧](library-stable/' + old + ') / [新](library-stable/' + new + ') |\n')
print(json.dumps({k: result[k] for k in ('sources', 'conditionsPerVariant', 'overflowConditions', 'brokenImageConditions', 'acceptance')}, ensure_ascii=False))
