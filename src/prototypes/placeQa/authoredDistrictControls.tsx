import { useState } from 'react';
import type { AuthoredDistrictCatalog, AuthoredDistrictGrant, availableAuthoredDistrictPorts } from '../../domain/growingIsland/authoredDistrictWorld';

type Port = ReturnType<typeof availableAuthoredDistrictPorts>[number];
interface Props {
    catalog: AuthoredDistrictCatalog;
    ports: readonly Port[];
    grants: readonly AuthoredDistrictGrant[];
    preview?: AuthoredDistrictGrant;
    onPreview: (templateId: string, port: Port) => void;
    onConfirm: () => void;
    onCancel: () => void;
}
const portKey = (port: Port) => JSON.stringify([port.districtId, port.id]);
const directions = ['東', '南', '西', '北'];

export default function AuthoredDistrictControls({ catalog, ports, grants, preview, onPreview, onConfirm, onCancel }: Props) {
    const [selectedKey, setSelectedKey] = useState('');
    const selected = ports.find(port => portKey(port) === selectedKey) ?? ports[0];
    const previewTemplate = catalog.templates.find(template => template.id === preview?.templateId);
    return <section aria-label="地区の組み立て診断" data-authored-district-controls>
        <h2>島の形を変える · 診断</h2>
        <p>地形を選んで、島につなぎます。個人の保存や土地購入には反映しません。確定済み {grants.length}地区。</p>
        <label>接続する場所<br/>
            <select aria-label="地区をつなぐ場所" data-district-port style={{ minHeight: 44, maxWidth: '100%', font: 'inherit' }} value={selected ? portKey(selected) : ''} disabled={Boolean(preview) || !selected} onChange={event => setSelectedKey(event.target.value)}>
                {ports.map(port => {
                    const grantIndex = grants.findIndex(grant => grant.id === port.districtId);
                    return <option key={portKey(port)} value={portKey(port)}>{grantIndex < 0 ? 'もとの島' : `追加した地区${grantIndex + 1}`} · {directions[port.facing]} · {port.id}</option>;
                })}
            </select>
        </label>
        <p>追加する地形</p>
        <div className="authored-actions">
            {catalog.templates.map(template => <button key={template.id} data-district-template={template.id} aria-pressed={preview?.templateId === template.id} disabled={Boolean(preview) || !selected} onClick={() => selected && onPreview(template.id, selected)}>{template.label}を試す</button>)}
        </div>
        {preview && <><p role="status">「{previewTemplate?.label}」のプレビュー中です。島のものの編集は一時停止しています。</p><div className="authored-actions">
            <button data-district-confirm onClick={onConfirm}>追加（診断）</button>
            <button data-district-cancel onClick={onCancel}>やめる</button>
        </div></>}
        {!selected && <p>接続できる場所がありません。</p>}
    </section>;
}
