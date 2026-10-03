import { useState, useId, useRef, useEffect } from 'react';

export function PersonPicker({ value, onChange, names }: { value: string; onChange: (name: string) => void; names: string[] }) {
  const [open, setOpen] = useState(false), id = useId(), root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  const choices = ['All Name', ...names.filter(name => value === 'All Name' || name.toLowerCase().includes(value.toLowerCase()))];
  return <div ref={root} className="person-combo"><label>PIC / Implementor<div className="person-combo-control"><input aria-label="PIC / Implementor" role="combobox" aria-expanded={open} aria-controls={id} aria-autocomplete="list" value={value} onFocus={e => { if (value === 'All Name') e.target.select(); }} onChange={e => { onChange(e.target.value); setOpen(true); }} onKeyDown={e => { if (e.key === 'Escape') setOpen(false); if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); } }} placeholder="All Name atau ketik nama"/><button type="button" aria-label="Tampilkan daftar PIC / Implementor" aria-expanded={open} onClick={() => setOpen(previous => !previous)}>⌄</button></div></label>{open && <div id={id} className="person-combo-menu">{choices.map(name => <button key={name} className="person-combo-option" onClick={() => { onChange(name); setOpen(false); }}>{name}</button>)}</div>}</div>;
}
