// 교재: 서점 검색 링크 (키 없이), 최신판 판단
import type { BookEdition, Textbook } from './types';

export const storeLinks = (q: string) => ({
  알라딘: `https://www.aladin.co.kr/search/wsearchresult.aspx?SearchTarget=Book&SearchWord=${encodeURIComponent(q)}`,
  교보문고: `https://search.kyobobook.co.kr/search?keyword=${encodeURIComponent(q)}`,
  YES24: `https://www.yes24.com/Product/Search?domain=BOOK&query=${encodeURIComponent(q)}`,
});

/** 찾은 판 중 지금 쓰는 판보다 새 것 (발행일 기준, ISBN이 같으면 같은 판) */
export function newerEdition(t: Textbook, eds: BookEdition[]): BookEdition | undefined {
  const top = eds[0];
  if (!top) return undefined;
  if (t.isbn && top.isbn === t.isbn) return undefined;
  if (t.date && top.date <= t.date) return undefined;
  return top;
}
