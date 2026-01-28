import { Link, Outlet, useLocation } from "react-router-dom";
import { FlaskConical, Archive, Github, Sun, Moon } from "lucide-react";
import { useTheme } from "../hooks/useTheme";

const Layout = () => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { path: "/config", label: "New Benchmark", icon: FlaskConical },
    { path: "/archives", label: "Archives", icon: Archive },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-900 flex flex-col transition-colors duration-300">
      <header className="bg-white dark:bg-neutral-800 border-b border-slate-200 dark:border-neutral-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link to="/config" className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer">
              <span className="text-2xl" role="img" aria-label="book">
                📖
              </span>
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                ThinkOnWiki Benchmark
              </span>
            </Link>
            <nav className="flex gap-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex items-center gap-4">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Toggle theme"
              >
                {theme === "light" ? (
                  <Moon className="w-5 h-5" />
                ) : (
                  <Sun className="w-5 h-5" />
                )}
              </button>
              <a
                href="https://github.com/MaloLM/ThinkOnWikiBenchmark"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <Github className="w-6 h-6" />
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <Outlet />
      </main>

      <footer className="bg-white dark:bg-neutral-800 border-t border-slate-200 dark:border-neutral-700 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-500 dark:text-neutral-400 text-sm">
          &copy; {new Date().getFullYear()} ThinkOnWikiBenchmark - Wikipedia
          Navigation LLM Benchmark
        </div>
      </footer>
    </div>
  );
};

export default Layout;
