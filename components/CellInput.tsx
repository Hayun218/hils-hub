'use client';
// 표 칸 안에서 쓰는 글 칸: 한 줄처럼 보이다가 글이 길면 자동으로 줄을 바꾸고 칸 높이를 늘린다 (잘리지 않게).
// <input>과 같은 방식으로 쓴다 (value, onChange, onBlur, placeholder, disabled …). Enter는 줄바꿈.
import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';

export default function CellInput({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  useLayoutEffect(fit, [props.value, props.defaultValue, props.placeholder]);
  useLayoutEffect(() => {
    // 칸 너비가 바뀌면(창 크기, 열 너비) 높이를 다시 맞춘다
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return <textarea ref={ref} rows={1} className={`cell-input ${className}`} {...props} onInput={e => { fit(); props.onInput?.(e); }} />;
}
