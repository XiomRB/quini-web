'use client';

import dynamic from 'next/dynamic';

const QuinielaApp = dynamic(() => import('../components/QuinielaApp'), {
  ssr: false,
});

export default function Page() {
  return <QuinielaApp />;
}
