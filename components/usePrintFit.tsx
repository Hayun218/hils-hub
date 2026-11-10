'use client';
// 한 장 인쇄: 인쇄 직전에 그 영역의 실제 크기를 재서 A4 가로 한 장(여백 8mm)에 들어가게 비율을 맞추고 가운데에 놓는다.
import { useEffect, type RefObject } from 'react';

const PAGE = { w: 1062, h: 718 }; // A4 가로 297×210mm에서 여백 8mm를 뺀 크기 (96dpi, 머리글 여유 포함)

export function usePrintFit(ref: RefObject<HTMLElement | null>, opts: { onBefore?: () => void; onAfter?: () => void } = {}) {
  useEffect(() => {
    const before = () => {
      opts.onBefore?.();
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.width = `${r.width}px`; // 인쇄 중에 다시 줄바꿈되지 않게 지금 너비로 고정
      const scale = Math.min(1, PAGE.w / r.width, PAGE.h / el.scrollHeight);
      el.style.setProperty('--print-scale', String(scale));
    };
    const after = () => {
      const el = ref.current;
      if (el) { el.style.width = ''; el.style.removeProperty('--print-scale'); }
      opts.onAfter?.();
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); };
  });
}

/** 이 화면을 인쇄할 때만 A4 가로로 (화면에 있는 동안만 적용되는 @page) */
export function LandscapePage() {
  return <style>{'@media print { @page { size: A4 landscape; margin: 8mm; } }'}</style>;
}
