'use client';
// 교과 로드맵의 학교급 탭 (초등·중등·고등): 그 과정의 과정 안내(목표·학습 방법·수업 운영·평가), 로드맵 표, 교재를 한 화면에.
// 커리큘럼의 고정된 틀과 방법론을 보는 곳. 표 자체는 "전체 표 편집"에서 고친다.
import Link from 'next/link';
import { useHub } from '@/lib/store';
import { bandOf, bandSlice, type Band } from '@/lib/roadmaps';
import type { RoadmapDef, RoadmapGuide, Textbook } from '@/lib/types';
import RoadmapView from './Roadmap';
import CellInput from './CellInput';
import { Badge } from './ui';

const FIELDS: { k: keyof RoadmapGuide; label: string; ph: string }[] = [
  { k: 'goal', label: '이 과정의 목표', ph: '이 과정을 마치면 학생이 할 수 있는 것 (졸업·수료 지표, 별표 2와 연결)' },
  { k: 'method', label: '학습 방법', ph: '예: 자기주도 학습 후 교사 코칭, 하브루타, 소리 내어 읽기, 오답 노트 …' },
  { k: 'operation', label: '수업 운영', ph: '주당 시간·블록, 레벨 그룹, 교재 쓰는 순서, 쿼터별 흐름' },
  { k: 'evaluation', label: '평가', ph: '진단평가(매년 1쿼터 첫 주), 단원평가, 쿼터 말 점검, 학습 진도 보고서' },
];
const BAND_CLASS: Record<Band, string> = { 초등: '어니스트반', 중등: '드림반', 고등: '콜링반' };

/** 교재의 대상이 이 학교급인지 (대상이 학년이 아니면 모든 학교급에 보인다) */
const bookIn = (t: Textbook, band: Band) => !/^(예비초|초|중|고)/.test(t.target.trim()) || bandOf(t.target.trim()) === band;

export default function RoadmapBand({ rm, band, editable, onChange }: { rm: RoadmapDef; band: Band; editable: boolean; onChange: (rm: RoadmapDef) => void }) {
  const hub = useHub();
  const g: RoadmapGuide = { goal: '', method: '', operation: '', evaluation: '', ...rm.guides?.[band] };
  const set = (p: Partial<RoadmapGuide>) => onChange({ ...rm, guides: { ...rm.guides, [band]: { ...g, ...p } } });
  const slice = bandSlice(rm, band);
  const books = hub.textbooks.filter(t => t.subject === rm.subject && bookIn(t, band));

  return (
    <div className="stack">
      <div className="card band-guide">
        <div className="spread">
          <h3 style={{ margin: 0 }}>{rm.subject} · {band} 과정 <span className="tiny muted">{BAND_CLASS[band]}</span></h3>
          {!editable && <span className="tiny muted">관리자가 고칩니다</span>}
        </div>
        <div className="band-guide-grid">
          {FIELDS.map(f => (
            <div key={f.k} className="band-guide-item">
              <div className="band-guide-label">{f.label}</div>
              {editable
                ? <CellInput className="band-guide-text" value={g[f.k]} onChange={e => set({ [f.k]: e.target.value })} placeholder={f.ph} aria-label={f.label} />
                : <div className="band-guide-text">{g[f.k] || <span className="muted">아직 적지 않았습니다</span>}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        {slice.cols.length ? <RoadmapView rm={{ ...slice, title: `${rm.title} · ${band}` }} /> : <p className="muted small">이 로드맵에는 {band} 열이 없습니다. 전체 표 편집에서 열을 더하세요.</p>}
      </div>

      <div className="card">
        <div className="spread">
          <h3 style={{ margin: 0 }}>{band} 과정 교재</h3>
          <Link className="small" href="/subjects/books">교재 추가 · 관리 →</Link>
        </div>
        {books.length === 0 ? <p className="small muted" style={{ marginBottom: 0 }}>아직 {rm.subject} {band} 교재가 없습니다. 교재에서 교과를 &ldquo;{rm.subject}&rdquo;, 대상을 {band === '초등' ? '초1–초6' : band === '중등' ? '중1–중3' : '고1–고3'} 가운데로 넣으면 여기에 보입니다.</p> : (
          <div className="band-books">
            {books.map(t => (
              <div key={t.id} className="band-book">
                <div className="book-cover sm">{t.cover ? <img src={t.cover} alt="" /> : <span>{t.title.slice(0, 2)}</span>}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 4 }}><Badge tone={t.use === '주교재' ? 'green' : 'line'}>{t.use}</Badge>{t.target && <span className="tiny muted">{t.target}</span>}</div>
                  <b className="book-title small">{t.title}</b>
                  <div className="tiny muted">{[t.publisher, t.date && `${t.date} 판`].filter(Boolean).join(' · ')}</div>
                  {t.note && <div className="tiny" style={{ marginTop: 2 }}>{t.note}</div>}
                  {t.link && <a className="tiny" href={t.link} target="_blank" rel="noreferrer">구매 링크 ↗</a>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
