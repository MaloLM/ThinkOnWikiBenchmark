import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ConfigDashboard from './pages/ConfigDashboard';
import LiveMonitoring from './pages/LiveMonitoring';
import ArchiveExplorer from './pages/ArchiveExplorer';
import RunAnalysis from './pages/RunAnalysis';
import Layout from './components/Layout';
import { ThemeProvider } from './hooks/useTheme';

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/config" replace />} />
            <Route path="config" element={<ConfigDashboard />} />
            <Route path="live/:run_id" element={<LiveMonitoring />} />
            <Route path="archives" element={<ArchiveExplorer />} />
            <Route path="archives/:run_id" element={<RunAnalysis />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
