'use client';

import dynamic from 'next/dynamic';

const RiskMap = dynamic(() => import('../../../src/views/RiskMap'), {
  ssr: false,
  loading: () => <div className="card p-6 text-slate-500">Loading map…</div>,
});

export default function RiskMapPage() {
  return <RiskMap />;
}
