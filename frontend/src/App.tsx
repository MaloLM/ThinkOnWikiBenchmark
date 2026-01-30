import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Layout from './components/Layout';
import { ThemeProvider } from './hooks/useTheme';
import { Loader2 } from 'lucide-react';

// Lazy load pages for code splitting
const ConfigDashboard = lazy(() => import('./pages/ConfigDashboard'));
const LiveMonitoring = lazy(() => import('./pages/LiveMonitoring'));
const ArchiveExplorer = lazy(() => import('./pages/ArchiveExplorer'));
const RunAnalysis = lazy(() => import('./pages/RunAnalysis'));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center h-[calc(100vh-12rem)]">
    <div className="text-center">
      <Loader2 className="w-12 h-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
      <p className="text-slate-600 dark:text-slate-400">Loading...</p>
    </div>
  </div>
);

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/config" replace />} />
              <Route path="config" element={<ConfigDashboard />} />
              <Route path="live/:run_id" element={<LiveMonitoring />} />
              <Route path="archives" element={<ArchiveExplorer />} />
              <Route path="archives/:run_id" element={<RunAnalysis />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
