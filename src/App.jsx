import React, {useState} from 'react'

import InputBlock from './components/InputBlock'

function parsePath(path){
  const parts = [];
  if(!path) return parts;
  const raw = path.split('.');
  raw.forEach(token=>{
    const re = /^([^\[\]]+)(?:\[(\d+)\])?$/;
    const m = token.match(re);
    if(m){
      const key = m[1];
      if(typeof m[2] !== 'undefined') parts.push({key, index: parseInt(m[2],10)});
      else parts.push({key});
    } else parts.push({key:token});
  });
  return parts;
}

function getValue(obj, tokens){
  let cur = obj;
  for(const t of tokens){
    if(cur == null) return undefined;
    if(typeof t.index !== 'undefined'){
      cur = cur[t.key];
      if(!Array.isArray(cur)) return undefined;
      cur = cur[t.index];
    } else cur = cur[t.key];
  }
  return cur;
}

function setValueAtPath(obj, tokens, value){
  if(tokens.length===0) return;
  let cur = obj;
  for(let i=0;i<tokens.length;i++){
    const t = tokens[i];
    const last = (i===tokens.length-1);
    if(typeof t.index !== 'undefined'){
      if(!(t.key in cur) || !Array.isArray(cur[t.key])) cur[t.key] = [];
      while(cur[t.key].length <= t.index) cur[t.key].push(undefined);
      if(last) cur[t.key][t.index] = value;
      else { if(cur[t.key][t.index] == null) cur[t.key][t.index] = {}; cur = cur[t.key][t.index]; }
    } else {
      if(last) cur[t.key] = value;
      else { if(!(t.key in cur) || typeof cur[t.key] !== 'object' || cur[t.key] === null) cur[t.key] = {}; cur = cur[t.key]; }
    }
  }
}

function defaultBase(){
  return {state:'OK',message:null,serverTime:Date.now(),data:{pageCount:1,count:0,abVersions:null,data:[],expIds:null}};
}

function mergeParsedResponses(list, opts){
  const mergedItems = [];
  const base = list.length ? JSON.parse(JSON.stringify(list[0].parsed)) : defaultBase();
  list.forEach(({parsed, filter})=>{
    const arr = (parsed && parsed.data && Array.isArray(parsed.data.data)) ? parsed.data.data : (Array.isArray(parsed) ? parsed : []);
    if(!Array.isArray(arr)) return;
    arr.forEach(item=>{
      if(!filter) mergedItems.push(item);
      else {
        const newItem = {};
        const parts = filter.split(',').map(s=>s.trim()).filter(Boolean);
        parts.forEach(p=>{
          let path = p;
          if(path.startsWith('data.data.')) path = path.slice('data.data.'.length);
          if(path.startsWith('data.')) path = path.slice('data.'.length);
          const tokens = parsePath(path);
          const val = getValue(item, tokens);
          setValueAtPath(newItem, tokens, val);
        });
        mergedItems.push(newItem);
      }
    });
  });

  let finalItems = mergedItems;
  if(opts.dedupe){
    const seen = new Set();
    finalItems = mergedItems.filter(it=>{
      const id = (it && typeof it.reviewid!=='undefined') ? String(it.reviewid) : JSON.stringify(it);
      if(seen.has(id)) return false; seen.add(id); return true;
    });
  }
  base.data = base.data || {};
  base.data.data = finalItems;
  base.data.count = finalItems.length;
  base.serverTime = Date.now();
  base.data.pageCount = base.data.pageCount || 1;
  return base;
}

export default function App(){
  const [inputs, setInputs] = useState([ {id:Date.now(), json:'', filter:''} ]);
  const [result, setResult] = useState('');
  const [dedupe, setDedupe] = useState(true);
  const [pretty, setPretty] = useState(true);

  function addInput(){ setInputs(s=>[...s, {id:Date.now()+Math.random(), json:'', filter:''}]); }
  function removeInput(id){ setInputs(s=>s.filter(x=>x.id!==id)); }
  function updateInput(id, changes){ setInputs(s=>s.map(x=> x.id===id ? {...x,...changes} : x)); }

  function merge(){
    const parsedList = [];
    for(const it of inputs){
      if(!it.json.trim()) continue;
      try{
        const parsed = JSON.parse(it.json);
        parsedList.push({parsed, filter: it.filter || ''});
      }catch(e){ alert('Invalid JSON in one input: '+e.message); return; }
    }
    const merged = mergeParsedResponses(parsedList, {dedupe});
    setResult(pretty ? JSON.stringify(merged, null, 2) : JSON.stringify(merged));
  }

  function copyResult(){ navigator.clipboard.writeText(result).then(()=>alert('Copied')); }
  function downloadResult(){ const blob = new Blob([result], {type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='merged.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }

  function loadSample(id){
    const sample = JSON.stringify({
      state:'OK',
      message:null,
      serverTime:1600000000000,
      data:{
        pageCount:1,
        count:2,
        abVersions:null,
        data:[
          {reviewid:1,rfxid:'r1',productid:'p1',content:'A',prodAttrs:[{attrname:'color',attrvalue:'red'}],helpfulcount:0},
          {reviewid:2,rfxid:'r2',productid:'p1',content:'B',prodAttrs:[{attrname:'color',attrvalue:'blue'}],helpfulcount:1}
        ],
        expIds:null
      }
    }, null, 2);
    updateInput(id,{json:sample});
  }

  function togglePretty(){
    const newPretty = !pretty;
    setPretty(newPretty);
    if(!result) return;
    try{
      const parsed = JSON.parse(result);
      setResult(newPretty ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed));
    }catch(e){ /* ignore malformed result */ }
  }

  return (
    <div className="app container">
      <h1>JSON Merger & Filter (React)</h1>
      <p className="lead">Paste multiple JSON responses, provide per-input filter paths (e.g. <code>prodAttrs[0].attrvalue</code>), then merge.</p>

      <div className="inputs">
        {inputs.map(it=> (
          <InputBlock key={it.id} id={it.id} json={it.json} filter={it.filter}
            onChange={(changes)=>updateInput(it.id, changes)} onRemove={()=>removeInput(it.id)} onLoadSample={()=>loadSample(it.id)} />
        ))}
      </div>

      <div className="controls">
        <button onClick={addInput}>+ Add input</button>
        <label style={{marginLeft:12}}><input type="checkbox" checked={dedupe} onChange={e=>setDedupe(e.target.checked)} /> Deduplicate by <code style={{marginLeft:6}}>reviewid</code></label>
        <button className="primary" onClick={merge} style={{marginLeft:12}}>Merge</button>
      </div>

      <section className="output">
        <h2>Merged JSON</h2>
        <div className="output-actions">
          <button onClick={copyResult}>Copy</button>
          <button onClick={downloadResult}>Download</button>
          <button onClick={togglePretty}>Toggle Compact/Pretty</button>
        </div>
        <pre className="result" spellCheck={false}>{result}</pre>
      </section>
    </div>
  )
}
