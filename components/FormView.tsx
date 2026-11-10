'use client';
// 별지 서식 템플릿 화면. 같은 화면이 작성(onChange 있음)과 보기·인쇄(onChange 없음)를 함께 맡는다.
import { inline } from '@/lib/markdown';
import { cellText, repeatRows, type Block, type Cell, type FormValues } from '@/lib/formTemplate';
import type { FormValue, Student } from '@/lib/types';

interface Props {
  blocks: Block[];
  values: FormValues;
  onChange?: (key: string, v: FormValue) => void;
  students?: Student[];
}

export default function FormView({ blocks, values, onChange, students = [] }: Props) {
  const ro = !onChange;
  const set = (k: string, v: FormValue) => onChange?.(k, v);
  const str = (k: string) => (typeof values[k] === 'string' ? (values[k] as string) : '');

  const cell = (c: Cell, i: number) => {
    if (c.kind === 'static') return <td key={i}>{inline(c.text)}</td>;
    if (c.kind === 'choice') {
      const cur = values[c.key];
      const list = Array.isArray(cur) ? (cur as string[]) : typeof cur === 'string' && cur ? [cur] : [];
      return (
        <td key={i}>
          <div className="ff-choices">
            {c.options.map(o => {
              const on = list.includes(o);
              if (ro) return <span key={o} className={`ff-choice${on ? ' on' : ''}`}>{o}</span>;
              return (
                <button type="button" key={o} className={`ff-choice${on ? ' on' : ''}`}
                  onClick={() => set(c.key, c.multi ? (on ? list.filter(x => x !== o) : [...list, o]) : on ? '' : o)}>{o}</button>
              );
            })}
          </div>
        </td>
      );
    }
    if (ro) return <td key={i}>{c.prefix}{c.student ? students.find(s => s.id === str(c.key))?.name || str(c.key) : str(c.key)}{c.suffix}</td>;
    return (
      <td key={i}>
        <div className="ff-inline">
          {c.prefix && <span className="muted">{c.prefix}</span>}
          {c.student ? (
            <select className="ff-input" value={str(c.key)} onChange={e => set(c.key, e.target.value)} aria-label="학생">
              <option value="">학생 선택</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          ) : (
            <input className="ff-input" type={c.date ? 'date' : 'text'} placeholder={c.placeholder} value={str(c.key)} onChange={e => set(c.key, e.target.value)} />
          )}
          {c.suffix && <span className="muted">{c.suffix}</span>}
        </div>
      </td>
    );
  };

  return (
    <div className="ff">
      {blocks.map((b, bi) => {
        switch (b.t) {
          case 'h': return b.level === 2 ? <h2 key={bi}>{b.text}</h2> : <h3 key={bi}>{b.text}</h3>;
          case 'p': return <p key={bi}>{inline(b.text)}</p>;
          case 'quote': return <blockquote key={bi}>{inline(b.text)}</blockquote>;
          case 'li': return <ul key={bi} className={/^\d+\)/.test(b.text) ? 'ff-sub' : undefined}><li>{inline(b.text)}</li></ul>;
          case 'check': {
            const on = values[b.key] === true;
            const tk = `${b.key}:text`;
            return (
              <div key={bi} className="ff-check">
                {ro ? <span className="ff-box">{on ? '☑' : '☐'}</span>
                  : <input type="checkbox" checked={on} onChange={e => set(b.key, e.target.checked)} aria-label={b.text} />}
                <span>{inline(b.input ? b.text.slice(0, -1) : b.text)}</span>
                {b.input && (ro ? <b>{str(tk)}</b> : <input className="ff-input" value={str(tk)} onChange={e => set(tk, e.target.value)} aria-label={b.text} />)}
              </div>
            );
          }
          case 'field':
            return (
              <div key={bi} className="ff-field">
                <div className="ff-label">{inline(b.label)}</div>
                {ro ? <div className="ff-ro">{str(b.key) || ' '}</div>
                  : b.multiline ? <textarea className="ff-input" value={str(b.key)} onChange={e => set(b.key, e.target.value)} aria-label={b.label} />
                  : <input className="ff-input" value={str(b.key)} onChange={e => set(b.key, e.target.value)} aria-label={b.label} />}
              </div>
            );
          case 'area':
            return ro ? <div key={bi} className="ff-ro area">{str(b.key) || ' '}</div>
              : <textarea key={bi} className="ff-input area" placeholder={b.placeholder} value={str(b.key)} onChange={e => set(b.key, e.target.value)} aria-label={b.placeholder} />;
          case 'table': {
            const fixed = b.repeat ? b.rows.filter(r => r.some(c => c.kind === 'static' && c.text)) : b.rows;
            const rep = b.repeat ? repeatRows(b, values) : [];
            const setRep = (rows: string[][]) => set(`${b.key}#rows`, rows);
            return (
              <div key={bi} className="table-wrap">
                <table>
                  <thead><tr>{b.header.map((h, i) => <th key={i}>{inline(h)}</th>)}</tr></thead>
                  <tbody>
                    {fixed.map((r, ri) => <tr key={ri}>{r.map(cell)}</tr>)}
                    {rep.map((r, ri) => (
                      <tr key={`r${ri}`}>
                        {r.map((v, ci) => (
                          <td key={ci}>{ro ? v : <input className="ff-input" value={v} aria-label={b.header[ci]}
                            onChange={e => setRep(rep.map((row, j) => (j === ri ? row.map((x, k) => (k === ci ? e.target.value : x)) : row)))} />}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {b.repeat && !ro && (
                  <div className="row" style={{ marginTop: 4 }}>
                    <button type="button" className="btn sm" onClick={() => setRep([...rep, b.header.map(() => '')])}>+ 행 추가</button>
                    {rep.length > 1 && <button type="button" className="btn sm" onClick={() => setRep(rep.slice(0, -1))}>마지막 행 삭제</button>}
                  </div>
                )}
              </div>
            );
          }
        }
      })}
    </div>
  );
}

export { cellText };
