import Link from 'next/link';
import { PageHead, ArtLink, FormLink, Badge } from '@/components/ui';

export const metadata = { title: '학생 여정 · HILS Hub' };

const STAGES = [
  {
    no: '01', name: '문의', arts: [28], forms: [],
    items: ['입학 안내 (제28조 제5항)', '학교 방향성 공유', '명단에 "문의"로 등록'],
    data: '학생 기본 정보, 보호자 연락처',
  },
  {
    no: '02', name: '체험 입학', arts: [15, 28], forms: [2],
    items: ['3주 체험', '영어·수학 진단 → 레벨 예상', '영성·공동체 관찰', '교사회 심사'],
    data: '진단 기록 (diagnosis)',
  },
  {
    no: '03', name: '입학', arts: [28], forms: [],
    items: ['학생 기록 수집·이용 동의 (제28조 제4항)', '전자기기 제출 (제31조 제2항)', '담임 지정 (제35조)', '레벨 확정 (제20조)'],
    data: '동의 여부, 기기 제출, 담임, 레벨',
  },
  {
    no: '04', name: '재학 (쿼터 반복)', arts: [25, 29, 31, 33], forms: [3, 4, 8],
    items: ['쿼터 첫 주: 진단·레벨 이동', '매일: 상점·벌점, 독서', '월 1회: 담임 정기 모임', '쿼터마다: 개별 정기 면담', '쿼터 마지막 주: 성장 보고서'],
    data: '레벨, 상점·벌점, 독서, 면담, 지도 사유',
  },
  {
    no: '05', name: '졸업 심사 → 졸업', arts: [16, 30], forms: [5],
    items: ['관통 기준 충족 확인 (별표 2)', '독서·검정고시 확인', '전 교사 심사', '졸업 = 학교 과정 수료'],
    data: '누적 기록 전체가 근거',
  },
];

const GUIDE = [
  { n: '1건', step: '1단계', who: '담임 면담' },
  { n: '2건', step: '2단계', who: '목사 면담' },
  { n: '3건', step: '3단계', who: '학부모 면담 (담임·생활교육)' },
  { n: '4건+', step: '4단계', who: '학교장 판단 (퇴교 포함)' },
];

export default function FlowPage() {
  return (
    <div className="page">
      <PageHead
        title="학생 여정과 기록 흐름"
        desc="학생 한 명이 문의부터 졸업까지 거치는 단계, 각 단계에서 쓰는 서식과 쌓이는 기록. 모든 기록은 학생별로 한곳(학생 기록)에 모입니다."
        right={<Link className="btn primary" href="/students">학생 명단에서 시연하기</Link>}
      />

      <div className="flow">
        {STAGES.map(s => (
          <div key={s.no} className={`stage ${s.no === '04' ? 'hl' : ''}`}>
            <div className="no">STEP {s.no}</div>
            <h3>{s.name}</h3>
            <ul>{s.items.map(i => <li key={i}>{i}</li>)}</ul>
            <div className="row" style={{ marginTop: 10 }}>
              {s.arts.map(a => <ArtLink key={a} no={a} />)}
              {s.forms.map(f => <FormLink key={f} no={f} />)}
            </div>
            <div className="tiny muted" style={{ marginTop: 8 }}>쌓이는 기록: {s.data}</div>
          </div>
        ))}
      </div>

      <div className="grid g2" style={{ marginTop: 20 }}>
        <div className="card" id="pipeline">
          <h2>기록이 흘러가는 길 (파이프라인)</h2>
          <ol className="small" style={{ paddingLeft: 18, margin: 0 }}>
            <li><b>입력</b> · 교사가 학생 상세 화면에서 기록을 남긴다. 기록 종류마다 근거 서식이 정해져 있다 (면담 → 별지 8, 지도 사유 → 별지 4, 상점·벌점 → 별표 8).</li>
            <li><b>자동 판단</b> · 시스템이 학칙 규칙을 적용한다. 벌점이 쿼터 안에서 5점이 될 때마다 지도 사유를 만들고, 누적 건수로 면담 단계를 정하고, 면담 일지 제목을 규칙대로 붙인다.</li>
            <li><b>공개 범위</b> · 지도 사유와 지도 면담은 비공개로 저장한다 (제38조).</li>
            <li><b>출력</b> · 월간 일지(학부모용)와 쿼터 성장 보고서(별지 3)는 공개 기록만 모아 자동으로 만든다.</li>
            <li><b>졸업 심사</b> · 입학부터 쌓인 기록을 근거로 별지 5를 채운다.</li>
          </ol>
        </div>

        <div className="card" id="guidance">
          <div className="spread"><h2>단계별 지도 면담</h2><ArtLink no={33} /></div>
          <p className="small" style={{ marginTop: 0 }}>지도 사유 1건 = 제32조 제2항의 행동, 전자기기 적발, 또는 쿼터 벌점 5점마다. 같은 학년도 누적으로 단계가 올라가고, 학년도가 바뀌면 새로 셉니다.</p>
          <table className="t">
            <thead><tr><th>누적</th><th>단계</th><th>면담</th></tr></thead>
            <tbody>{GUIDE.map(g => <tr key={g.step}><td>{g.n}</td><td><Badge tone="orange">{g.step}</Badge></td><td>{g.who}</td></tr>)}</tbody>
          </table>
          <p className="tiny muted">발견 당일 별지 4 기록 → 그 주 안에 해당 단계 면담 → 별지 8에 "[지도-N단계] 학생 · 사유 · 날짜" 제목으로 기록. 안전 사안은 단계와 관계없이 당일 보호자 알림.</p>
        </div>
      </div>
    </div>
  );
}
