/** @type {import('next').NextConfig} */
const nextConfig = {
  // 타입 오류는 빌드에서 잡는다 (npm run typecheck 통과). 린트는 eslint 설정 전까지 건너뛴다.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
