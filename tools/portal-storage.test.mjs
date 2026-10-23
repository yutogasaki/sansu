import {test} from 'vitest';
import assert from 'node:assert/strict';
import {packRegistry,hydrateRegistry} from './portal-registry.mjs';
test('partitioned registry restores full order, Japanese, source fields and unknown data',()=>{
 const full={schemaVersion:1,title:'資料',pages:[],resources:[],unknown:{reason:'採用は未確認'},items:Array.from({length:5},(_,i)=>({key:'項目-'+i,target:'read/a.html',kind:i===0?'code':'text',category:'関連資料',title:'資料 '+i,pageTitle:'原題',text:'異体字𝟘・島\n'+i,attributes:{'data-unknown':'<script>原文</script>'},unknown:[false,null,{verbatim:'\\u003c'}]}))};
 const packed=packRegistry(full,{chunkSize:2});
 assert.equal(packed.catalog.itemStorage.shards.length,3);
 assert.deepEqual(hydrateRegistry(packed.catalog,p=>packed.files.get(p)),full);
 assert.throws(()=>hydrateRegistry(packed.catalog,p=>packed.files.get(p)+' '),/hash mismatch/);
 const wrong=structuredClone(packed.catalog);wrong.itemStorage.count++;assert.throws(()=>hydrateRegistry(wrong,p=>packed.files.get(p)),/count mismatch/);
 const unsafe=structuredClone(packed.catalog);unsafe.itemStorage.shards[0].path='../private';assert.throws(()=>hydrateRegistry(unsafe,()=>''),/Unsafe/);
});
