import React from 'react'

export default function InputBlock({id,json,filter,onChange,onRemove,onLoadSample}){
  return (
    <div className="input-block">
      <div className="input-header">
        <strong>Input</strong>
        <div className="header-actions">
          <button onClick={onLoadSample}>Sample</button>
          <button onClick={onRemove}>Remove</button>
        </div>
      </div>
      <textarea className="jsonInput" placeholder="Paste JSON response here" value={json} onChange={e=>onChange({json:e.target.value})} />
      <div className="filter-row">
        <label>Filter path(s): <input className="filterInput" placeholder="e.g. data.data.prodAttrs[0].attrvalue, content" value={filter} onChange={e=>onChange({filter:e.target.value})} /></label>
      </div>
      <div className="error" aria-live="polite"></div>
    </div>
  )
}
