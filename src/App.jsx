import React, {useState} from 'react'

import InputBlock from './components/InputBlock'

function parsePath(path){
  const parts = [];
  if(!path) return parts;
  const raw = path.split('.');
  raw.forEach(token=>{
    const re = /^([^\[\]]+)(?:\[(\d+|\*)\])?$/;
    const m = token.match(re);
    if(m){
      const key = m[1];
      if(typeof m[2] !== 'undefined'){
        const idx = m[2] === '*' ? '*' : parseInt(m[2],10);
        parts.push({key, index: idx});
      } else parts.push({key});
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
    // Only dedupe items that include a reviewid. If an item doesn't have reviewid (e.g. user filtered it out),
    // keep it — deduping by JSON string would collapse distinct items that happen to share the same filtered value.
    finalItems = mergedItems.filter(it=>{
      if(it && typeof it.reviewid !== 'undefined'){
        const id = String(it.reviewid);
        if(seen.has(id)) return false;
        seen.add(id);
        return true;
      }
      // keep items without reviewid (don't dedupe)
      return true;
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
  const [inputs, setInputs] = useState([ {id:Date.now(), json:'', filter:'', error:null, lastApplied:null} ]);
  const [result, setResult] = useState('');
  const [dedupe, setDedupe] = useState(false);
  const [pretty, setPretty] = useState(true);
  const [universalFilter, setUniversalFilter] = useState('');
  const [aggregateAttrName, setAggregateAttrName] = useState('Options');
  const [aggregateMatchPath, setAggregateMatchPath] = useState('prodAttrs[*].attrname');
  const [aggregateMatchValue, setAggregateMatchValue] = useState('Options');
  const [aggregateCountPath, setAggregateCountPath] = useState('prodAttrs[*].attrvalue');
  const [aggregation, setAggregation] = useState({});
  const [focusId, setFocusId] = useState(null);

  // validation helpers and presets for path syntax
  function validatePath(path){
    if(!path || !path.trim()) return 'Path required';
    try{
      const tokens = parsePath(path.trim());
      if(!tokens.length) return 'Empty path';
      for(const t of tokens){
        if(!t.key || typeof t.key !== 'string') return 'Invalid token key';
        if(typeof t.index !== 'undefined'){
          if(!(t.index === '*' || (Number.isInteger(t.index) && t.index >= 0))) return 'Index must be a non-negative integer or *';
        }
      }
      return null;
    }catch(e){ return 'Invalid path'; }
  }

  const presets = [
    {name:'prodAttrs (attrname -> attrvalue)',
     matchPath:'prodAttrs[*].attrname', matchValue:'Options', countPath:'prodAttrs[*].attrvalue', universal:'prodAttrs[*].attrvalue'},
   {name:'Options → attrvalue',
    matchPath:'prodAttrs[*].attrname', matchValue:'Options', countPath:'prodAttrs[*].attrvalue', universal:'prodAttrs[*].attrvalue'},
    {name:'reviews (data.data[*] items)',
     matchPath:'data.data[*].reviewid', matchValue:'', countPath:'data.data[*].productid', universal:'data.data[*].reviewid'},
    {name:'items (generic items array)',
     matchPath:'items[*].type', matchValue:'', countPath:'items[*].id', universal:'items[*].id'},
  ];

  function applyPreset(p){
    setAggregateMatchPath(p.matchPath||'');
    setAggregateMatchValue(p.matchValue||'');
    setAggregateCountPath(p.countPath||'');
    if(p.universal) setUniversalFilter(p.universal);
  }

  // inline validation values for rendering
  const aggregateMatchPathError = validatePath(aggregateMatchPath);
  const aggregateCountPathError = validatePath(aggregateCountPath);

  function addInput(){
    const newItem = {id:Date.now()+Math.random(), json:'', filter:'', error:null, lastApplied:null};
    setInputs(s=>[newItem, ...s]);
    setFocusId(newItem.id);
  }
  function removeInput(id){ setInputs(s=>s.filter(x=>x.id!==id)); }
  function updateInput(id, changes){ setInputs(s=>s.map(x=> x.id===id ? {...x,...changes} : x)); }

  // Merge inputs; if appliedInputId is provided, mark that input as lastApplied
  function merge(appliedInputId){
    const parsedList = [];
    let hadError = false;
    for(const it of inputs){
      if(!it.json || !it.json.trim()) continue;
      try{
        const parsed = JSON.parse(it.json);
        // clear any previous error
        if(it.error) updateInput(it.id, {error: null});
        // use per-input filter if provided, otherwise fall back to universalFilter
        const filterToUse = (it.filter && it.filter.trim()) ? it.filter : (universalFilter && universalFilter.trim() ? universalFilter : '');
        parsedList.push({parsed, filter: filterToUse});
      }catch(e){
        // set per-input error and skip merging this input
        hadError = true;
        updateInput(it.id, {error: 'Invalid JSON: '+e.message});
      }
    }
    if(hadError){
      // do not produce a merged result until inputs are valid
      return;
    }
    const merged = mergeParsedResponses(parsedList, {dedupe});
    // compute aggregation counts synchronously and attach to merged result
    try{
      const items = merged.data && Array.isArray(merged.data.data) ? merged.data.data : [];
      const counts = computeAggregationCounts(items, aggregateMatchPath || `prodAttrs[*].attrname`, aggregateMatchValue || aggregateAttrName || 'Options', aggregateCountPath || `prodAttrs[*].attrvalue`);
      setAggregation(counts);
      if(counts && Object.keys(counts).length) merged.aggregation = counts;
    }catch(e){ /* ignore */ }
    const text = pretty ? JSON.stringify(merged, null, 2) : JSON.stringify(merged);
    setResult(text);
    if(appliedInputId) updateInput(appliedInputId, {lastApplied: Date.now()});
  }

  function clearAll(){
    const ok = window.confirm('Clear all inputs and results? This cannot be undone.');
    if(!ok) return;
    setInputs([{id:Date.now(), json:'', filter:'', error:null, lastApplied:null}]);
    setResult('');
    setAggregation({});
  }

  function computeAggregationFromItems(items, attrName){
      // New generic aggregation supports wildcard paths.
      const counts = {};
      if(!Array.isArray(items)){
        setAggregation({});
        return;
      }
      // default legacy behavior when attrName provided as simple string: treat as prodAttrs attrname
      // but we now support using aggregateMatchPath and aggregateCountPath from state
      // This function will be replaced by computeAggregationFromOptions when UI fields provided.
      items.forEach(item=>{
        if(!item || !Array.isArray(item.prodAttrs)) return;
        item.prodAttrs.forEach(p=>{
          if(!p) return;
          if(p.attrname === attrName){
            const v = String(typeof p.attrvalue === 'undefined' || p.attrvalue === null ? '' : p.attrvalue);
            counts[v] = (counts[v] || 0) + 1;
          }
        });
      });
      setAggregation(counts);
  }

    // Helper: resolve values by path supporting wildcard [*]
    function getValuesByPath(obj, path){
      if(!path) return [];
      const tokens = parsePath(path);
      function walk(current, idx){
        if(current == null) return [];
        if(idx >= tokens.length) return [current];
        const t = tokens[idx];
        if(typeof t.index === 'undefined'){
          return walk(current[t.key], idx+1);
        }
        // index present
        if(t.index === '*'){
          const arr = current[t.key];
          if(!Array.isArray(arr)) return [];
          let res = [];
          for(const el of arr){ res = res.concat(walk(el, idx+1)); }
          return res;
        }
        // numeric index
        const child = current[t.key];
        if(!Array.isArray(child)) return [];
        const el = child[t.index];
        return walk(el, idx+1);
      }
      return walk(obj, 0);
    }

    // Generic aggregation: compute counts (pure) and setter wrapper
    function computeAggregationCounts(items, matchPath, matchValue, countPath){
      const counts = {};
      if(!Array.isArray(items)) return counts;

      function rootBeforeWildcard(path){
        const i = path.indexOf('[*]');
        if(i===-1) return null;
        return path.slice(0, i);
      }

      const matchRoot = rootBeforeWildcard(matchPath);
      const countRoot = rootBeforeWildcard(countPath);

      items.forEach(item=>{
        if(matchRoot && countRoot && matchRoot === countRoot){
          const rootTokens = parsePath(matchRoot);
          const rootArr = (function(){
            let cur = item;
            for(const rt of rootTokens){ if(cur==null) return null; cur = cur[rt.key]; if(typeof rt.index !== 'undefined'){ if(rt.index==='*') return cur; else cur = cur[rt.index]; } }
            return cur;
          })();
          if(!Array.isArray(rootArr)) return;
          let remMatch = matchPath.slice(matchRoot.length + 3);
          let remCount = countPath.slice(countRoot.length + 3);
          // remove leading dot if present (e.g. '.attrname')
          if(remMatch.startsWith('.')) remMatch = remMatch.slice(1);
          if(remCount.startsWith('.')) remCount = remCount.slice(1);
          rootArr.forEach(el=>{
            const mvals = remMatch ? getValuesByPath(el, remMatch) : [el];
            const cvals = remCount ? getValuesByPath(el, remCount) : [el];
            const matched = mvals.some(v=>String(v) === String(matchValue));
            if(matched){
              cvals.forEach(cv=>{ const key = String(cv==null ? '' : cv); counts[key] = (counts[key]||0) + 1; });
            }
          });
        } else {
          const mvals = getValuesByPath(item, matchPath);
          const found = mvals.some(v=>String(v) === String(matchValue));
          if(found){
            const cvals = getValuesByPath(item, countPath);
            cvals.forEach(cv=>{ const key = String(cv==null ? '' : cv); counts[key] = (counts[key]||0) + 1; });
          }
        }
      });

      return counts;
    }

    function computeAggregationFromOptions(items, matchPath, matchValue, countPath){
      const counts = computeAggregationCounts(items, matchPath, matchValue, countPath);
      setAggregation(counts);
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
      <button className="clear-all" onClick={clearAll}>Clear All</button>
      <h1>JSON Merger & Filter (React)</h1>
      <p className="lead">Paste multiple JSON responses, provide per-input filter paths (e.g. <code>prodAttrs[0].attrvalue</code>), then merge.</p>

      <div className="controls">
        <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
          <button onClick={addInput}>+ Add input</button>
          <label style={{marginLeft:12}}><input type="checkbox" checked={dedupe} onChange={e=>setDedupe(e.target.checked)} /> Deduplicate by <code style={{marginLeft:6}}>reviewid</code></label>
          <button className="primary" onClick={merge} style={{marginLeft:12}}>Merge</button>
        </div>

        <div style={{marginTop:12,display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
          <label style={{display:'flex',alignItems:'center',gap:8}}>Universal filter (applies when per-input filter is empty):
            <input style={{marginLeft:6,padding:6,borderRadius:6}} value={universalFilter} onChange={e=>setUniversalFilter(e.target.value)} placeholder="e.g. data.data.prodAttrs[0].attrvalue" />
          </label>
          <button onClick={()=>merge()}>Apply universal</button>
        </div>

        <div style={{marginTop:12,display:'flex',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <label style={{display:'flex',gap:8,flexDirection:'column',alignItems:'flex-start'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span>Match path:</span>
                  <input style={{marginLeft:6,padding:6,borderRadius:6}} value={aggregateMatchPath||'prodAttrs[*].attrname'} onChange={e=>setAggregateMatchPath(e.target.value)} />
                </div>
                {aggregateMatchPathError ? <div style={{color:'#b91c1c',fontSize:12,marginTop:4}}>{aggregateMatchPathError}</div> : null}
              </label>
              <label style={{display:'flex',alignItems:'center',gap:8}}>Match value:
                <input style={{marginLeft:6,padding:6,borderRadius:6}} value={aggregateMatchValue||'Options'} onChange={e=>setAggregateMatchValue(e.target.value)} />
              </label>
              <label style={{display:'flex',gap:8,flexDirection:'column',alignItems:'flex-start'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span>Count path:</span>
                  <input style={{marginLeft:6,padding:6,borderRadius:6}} value={aggregateCountPath||'prodAttrs[*].attrvalue'} onChange={e=>setAggregateCountPath(e.target.value)} />
                </div>
                {aggregateCountPathError ? <div style={{color:'#b91c1c',fontSize:12,marginTop:4}}>{aggregateCountPathError}</div> : null}
              </label>
              <button disabled={!!(aggregateMatchPathError || aggregateCountPathError)} title={aggregateMatchPathError || aggregateCountPathError ? 'Fix path errors' : 'Compute counts'} onClick={()=>{
                try{
                  const parsed = result ? JSON.parse(result) : null;
                  const items = parsed && parsed.data && Array.isArray(parsed.data.data) ? parsed.data.data : [];
                  computeAggregationFromOptions(items, aggregateMatchPath||'prodAttrs[*].attrname', aggregateMatchValue||'Options', aggregateCountPath||'prodAttrs[*].attrvalue');
                }catch(e){ }
              }}>{(aggregateMatchPathError || aggregateCountPathError) ? 'Fix paths' : 'Compute counts'}</button>
            </div>
            <div style={{color:'#6b7280',fontSize:13}}>
              <div><strong>Path syntax</strong>: dot-separated keys. Use array index like <code>[0]</code> or wildcard <code>[*]</code> for all elements. Prefixes like <code>data.data.</code> are optional — the merger trims them when applying filters.</div>
              <div style={{marginTop:6}}>Examples: <code>prodAttrs[*].attrname</code>, <code>data.data[*].reviewid</code>, <code>items[*].id</code></div>
            </div>
          </div>

          <div style={{minWidth:260,display:'flex',flexDirection:'column',gap:8}}>
            <label style={{fontSize:13}}>Presets</label>
            <select onChange={e=>{ const p = presets[Number(e.target.value)]; if(p) applyPreset(p); }}>
              <option value="">— choose preset —</option>
              {presets.map((p,i)=> <option key={p.name} value={i}>{p.name}</option>)}
            </select>
            <div style={{color:'#9aa6b2',fontSize:13}}>Pick a preset to fill paths and the universal filter. You can edit the values afterwards.</div>
          </div>
        </div>
      </div>

      <div className="inputs">
        {inputs.map(it=> (
          <InputBlock
            key={it.id}
            id={it.id}
            json={it.json}
            filter={it.filter}
            error={it.error}
            lastApplied={it.lastApplied}
            onChange={(changes)=>updateInput(it.id, changes)}
            onRemove={()=>removeInput(it.id)}
            onLoadSample={()=>loadSample(it.id)}
            onApply={()=>merge(it.id)}
            autoFocus={focusId === it.id}
            onFocused={()=> setFocusId(null)}
            usingUniversal={!(it.filter && it.filter.trim()) && (universalFilter && universalFilter.trim())}
          />
        ))}
      </div>

      <section className="output">
        <h2>Merged JSON</h2>
        <div style={{marginBottom:8}}>
          <strong>Aggregation results</strong>
          {Object.keys(aggregation).length===0 ? <div style={{color:'#9aa6b2'}}>No aggregation yet</div> : (
            <div style={{marginTop:6}}>
              {Object.entries(aggregation).sort((a,b)=>b[1]-a[1]).map(([val,c])=> (
                <div key={val} style={{display:'flex',justifyContent:'space-between',gap:12,padding:'4px 0'}}>
                  <div style={{flex:1}}>{val || '(empty)'}</div>
                  <div style={{color:'#9aa6b2'}}>{c}</div>
                </div>
              ))}
            </div>
          )}
        </div>
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
