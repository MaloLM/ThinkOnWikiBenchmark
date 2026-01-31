import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Calendar, Cpu, CheckCircle2, XCircle, ChevronRight, Search, Loader2 } from 'lucide-react';
import { getArchives } from '../services/api';
import type { Archive } from '../services/api';
import Pagination from '../components/Pagination';
import { useDebounce } from '../hooks/useDebounce';

const MAX_VISIBLE_MODELS = 2;
const ITEMS_PER_PAGE = 7;

const ArchiveExplorer = () => {
  const navigate = useNavigate();
  const [archives, setArchives] = useState<Archive[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadArchives();
  }, []);

  const loadArchives = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getArchives();
      setArchives(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load archives');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredArchives = archives.filter((archive) => {
    const searchLower = debouncedSearchQuery.toLowerCase();
    return (
      archive.run_id.toLowerCase().includes(searchLower) ||
      archive.config.start_page?.toLowerCase().includes(searchLower) ||
      archive.config.target_page?.toLowerCase().includes(searchLower) ||
      archive.config.models?.some((m) => m.toLowerCase().includes(searchLower))
    );
  });

  // Reset page to 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredArchives.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedArchives = filteredArchives.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of table
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Archives</h1>
          <p className="text-slate-600 dark:text-slate-400">Review past benchmark results and paths.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search benchmarks..."
            className="pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white dark:bg-neutral-800 text-slate-900 dark:text-white w-full"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <button
              onClick={loadArchives}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        ) : filteredArchives.length === 0 ? (
          <div className="text-center py-16 text-slate-500 dark:text-slate-400">
            <p>{searchQuery ? 'No archives match your search' : 'No archives found. Start a benchmark to see results here.'}</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Date & Run ID</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Path</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Models</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedArchives.map((run) => (
                <tr 
                  key={run.run_id} 
                  onClick={() => navigate(`/archives/${run.run_id}`)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        {new Date(run.timestamp).toLocaleString('en-US')}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{run.run_id}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <span className="font-medium text-slate-800 dark:text-slate-200">{run.config.start_page}</span>
                      <ChevronRight className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                      <span className="font-medium text-slate-800 dark:text-slate-200">{run.config.target_page}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {run.config.models?.slice(0, MAX_VISIBLE_MODELS).map((model) => (
                        <span
                          key={model}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium"
                        >
                          <Cpu className="w-3 h-3" />
                          {model}
                        </span>
                      ))}
                      {run.config.models && run.config.models.length > MAX_VISIBLE_MODELS && (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 text-xs font-medium cursor-help"
                          title={run.config.models.slice(MAX_VISIBLE_MODELS).join(', ')}
                        >
                          +{run.config.models.length - MAX_VISIBLE_MODELS}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/archives/${run.run_id}`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                    >
                      View Analysis
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        
        </div>
        
        {/* Pagination */}
        {!isLoading && !error && filteredArchives.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            totalItems={filteredArchives.length}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        )}
      </div>
    </div>
  );
};

export default ArchiveExplorer;
