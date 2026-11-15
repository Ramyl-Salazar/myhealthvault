import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { screens } from './copy';
import { Placeholder } from './screens/Placeholder';
import { ErrorState } from './ui/ErrorState';
import { Skeleton } from './ui/Skeleton';

const DemoEntry = lazy(() => import('./screens/DemoEntry').then(module => ({ default: module.DemoEntry })));
const Timeline = lazy(() => import('./screens/Timeline').then(module => ({ default: module.Timeline })));
const RecordDetail = lazy(() => import('./screens/RecordDetail').then(module => ({ default: module.RecordDetail })));
const AddRecord = lazy(() => import('./screens/AddRecord').then(module => ({ default: module.AddRecord })));
const EditRecord = lazy(() => import('./screens/AddRecord').then(module => ({ default: module.EditRecord })));
const loading = <div className="app-column mx-auto p-4"><Skeleton /></div>;

function NeedsSession({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'ready' | 'absent' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    import('./data/supabase').then(({ supabase }) => supabase.auth.getSession()).then(({ data, error }) => {
      if (current) setState(error ? 'error' : data.session ? 'ready' : 'absent');
    }).catch(() => { if (current) setState('error'); });
    return () => { current = false; };
  }, [attempt]);

  const retry = useCallback(() => { setState('loading'); setAttempt(value => value + 1); }, []);
  if (state === 'loading') return <div className="app-column mx-auto p-4"><Skeleton /></div>;
  if (state === 'error') return <div className="app-column mx-auto p-4"><ErrorState onRetry={retry} /></div>;
  if (state === 'absent') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return <Routes>
    <Route path="/" element={<Suspense fallback={<div className="app-column mx-auto p-4"><Skeleton /></div>}><DemoEntry /></Suspense>} />
    <Route path="/s/:token" element={<Placeholder title={screens.shared} nav={false} />} />
    <Route path="/emergency" element={<Placeholder title={screens.emergency} nav={false} />} />
    <Route path="/home" element={<NeedsSession><Placeholder title={screens.home} /></NeedsSession>} />
    <Route path="/timeline" element={<NeedsSession><Suspense fallback={loading}><Timeline /></Suspense></NeedsSession>} />
    <Route path="/add" element={<NeedsSession><Suspense fallback={loading}><AddRecord /></Suspense></NeedsSession>} />
    <Route path="/records/:id" element={<NeedsSession><Suspense fallback={loading}><RecordDetail /></Suspense></NeedsSession>} />
    <Route path="/records/:id/edit" element={<NeedsSession><Suspense fallback={loading}><EditRecord /></Suspense></NeedsSession>} />
    <Route path="/scan" element={<NeedsSession><Placeholder title={screens.scan} /></NeedsSession>} />
    <Route path="/scan/confirm" element={<NeedsSession><Placeholder title={screens.scanConfirm} /></NeedsSession>} />
    <Route path="/share" element={<NeedsSession><Placeholder title={screens.share} /></NeedsSession>} />
    <Route path="/share/new" element={<NeedsSession><Placeholder title={screens.shareNew} /></NeedsSession>} />
    <Route path="/share/:id" element={<NeedsSession><Placeholder title={screens.shareDetail} /></NeedsSession>} />
    <Route path="/settings" element={<NeedsSession><Placeholder title={screens.settings} /></NeedsSession>} />
    <Route path="/print" element={<NeedsSession><Placeholder title={screens.print} /></NeedsSession>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
