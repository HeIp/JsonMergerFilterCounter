import React, { useRef, useEffect } from 'react'

export default function InputBlock({id,json,filter,error,lastApplied,onChange,onRemove,onLoadSample,onApply,autoFocus,onFocused,usingUniversal}){
  // Auto-format pasted JSON and on blur. Also surface parse errors via onChange({error: ...})
  const [justFocused, setJustFocused] = React.useState(false);
  function handlePaste(e){
    try{
      const txt = (e.clipboardData || window.clipboardData).getData('text');
      const parsed = JSON.parse(txt);
      const pretty = JSON.stringify(parsed, null, 2);
      e.preventDefault();
      onChange({json: pretty, error: null});
    }catch(err){
      // not JSON — allow default paste
    }
  }

  function handleBlur(e){
    const txt = e.target.value;
    try{
      const parsed = JSON.parse(txt);
      const pretty = JSON.stringify(parsed, null, 2);
      if(pretty !== txt) onChange({json: pretty, error: null});
      else onChange({error: null});
    }catch(err){
      onChange({error: 'Invalid JSON: '+err.message});
    }
  }

  // Debounced auto-apply when filter text changes
  const timerRef = useRef(null);
  function handleFilterChange(e){
    const v = e.target.value;
    onChange({filter: v});
    if(timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(()=>{
      onApply && onApply();
    }, 700);
  }

  useEffect(()=>{
    return ()=>{ if(timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const textareaRef = React.useRef(null);

  React.useEffect(()=>{
    if(autoFocus && textareaRef.current){
      textareaRef.current.focus();
      // move cursor to end
      const v = textareaRef.current.value; textareaRef.current.value = ''; textareaRef.current.value = v;
      setJustFocused(true);
      onFocused && onFocused();
      // remove focused state after animation
      setTimeout(()=>setJustFocused(false),700);
    }
  }, [autoFocus, onFocused]);

  return (
    <div className={"input-block" + (justFocused ? ' focused' : '')}>
      <div className="input-header">
        <strong>Input</strong>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {usingUniversal ? <span className="badge">uses universal</span> : null}
          <div className="header-actions">
            <button onClick={onLoadSample}>Sample</button>
            <button onClick={onRemove}>Remove</button>
          </div>
        </div>
      </div>
      <textarea
        className="jsonInput"
        placeholder="Paste JSON response here"
        value={json}
        onChange={e=>onChange({json:e.target.value})}
        onPaste={handlePaste}
        onBlur={handleBlur}
        ref={textareaRef}
      />
      <div className="filter-row">
        <label style={{flex:1,display:'flex',alignItems:'center',gap:8}}>
          <span style={{whiteSpace:'nowrap'}}>Filter path(s):</span>
          <input
            className="filterInput"
            placeholder="e.g. data.data.prodAttrs[0].attrvalue, content"
            value={filter}
            onChange={handleFilterChange}
            style={{flex:1}}
          />
          <button onClick={onApply}>Apply</button>
        </label>
      </div>
      <div className="error" aria-live="polite">{error || ''}</div>
      <div style={{marginTop:6,color:'#9aa6b2',fontSize:12}}>{lastApplied ? 'Last applied: '+(new Date(lastApplied)).toLocaleString() : ''}</div>
    </div>
  )
}
