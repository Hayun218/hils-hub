// 교직원 권한. 관리자가 계정마다 켜고 끈다. 운영 단계에서는 staff.permissions + RLS로 옮긴다.
import type { Account, Permission } from './types';

export const PERMISSIONS: { key: Permission; label: string; desc: string }[] = [
  { key: 'admin', label: '관리자', desc: '가입 승인, 권한 부여 (모든 권한 포함)' },
  { key: 'hakchik', label: '학칙 편집', desc: '학칙 원문 수정. 개정 승인은 제5조 절차를 따른다' },
  { key: 'students', label: '학생 관리', desc: '학생 추가, 상태·담임 변경' },
  { key: 'private', label: '비공개 기록 열람', desc: '지도 사유·지도 면담 (제38조 제2항)' },
  { key: 'accounting', label: '회계 승인', desc: '구입 신청 승인·반려' },
  { key: 'schedule', label: '시간표·당번표', desc: '시간표·당번표 생성과 확정' },
];

/** 승인 대기·거절 계정은 아무 권한도 없다. 관리자는 모든 권한을 가진다. */
export function can(a: Account | null | undefined, p: Permission): boolean {
  if (!a || a.status !== '승인') return false;
  return a.permissions.includes('admin') || a.permissions.includes(p);
}
