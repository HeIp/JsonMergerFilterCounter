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
  const [aggregation, setAggregation] = useState({});

  function addInput(){
    const newItem = {id:Date.now()+Math.random(), json:'', filter:'', error:null, lastApplied:null};
    setInputs(s=>[newItem, ...s]);
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
    const text = pretty ? JSON.stringify(merged, null, 2) : JSON.stringify(merged);
    setResult(text);
    // compute aggregation counts based on merged items
    computeAggregationFromItems(merged.data && Array.isArray(merged.data.data) ? merged.data.data : [], aggregateAttrName);
    if(appliedInputId) updateInput(appliedInputId, {lastApplied: Date.now()});
  }

  function computeAggregationFromItems(items, attrName){
    const counts = {};
    if(!Array.isArray(items)){
      setAggregation({});
      return;
    }
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

        <div style={{marginTop:12,display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
          <label style={{display:'flex',alignItems:'center',gap:8}}>Aggregate prodAttrs where <code>attrname</code> =
            <input style={{marginLeft:6,padding:6,borderRadius:6}} value={aggregateAttrName} onChange={e=>setAggregateAttrName(e.target.value)} />
          </label>
          <button onClick={()=>(
            // compute from current result if available
            (()=>{
              try{
                const parsed = result ? JSON.parse(result) : null;
                const items = parsed && parsed.data && Array.isArray(parsed.data.data) ? parsed.data.data : [];
                computeAggregationFromItems(items, aggregateAttrName);
              }catch(e){
                // if result not JSON, do nothing
              }
            })()
          )}>Compute counts</button>
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
