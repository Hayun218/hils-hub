/** @type {import('next').NextConfig} */
const nextConfig = {
  // 타입 오류는 빌드에서 잡는다 (npm run typecheck 통과). 린트는 eslint 설정 전까지 건너뛴다.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: true },
  // 교과 로드맵은 커리큘럼 설계라 교과관리 아래로 옮김 (예전 주소 → 새 주소)
  async redirects() { return [{ source: '/reports/template', destination: '/subjects/roadmap', permanent: false }]; },
};

export default nextConfig;
