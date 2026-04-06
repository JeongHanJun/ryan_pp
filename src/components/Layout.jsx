import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Brain, Users, Gamepad2, GitCompare, Eye } from 'lucide-react';
import useLangStore from '../store/langStore';
import { t } from '../i18n/texts';

const tabs = [
  { path: '/personality', icon: Brain, labelKey: 'tab_personality' },
  { path: '/persona', icon: Users, labelKey: 'tab_persona' },
  { path: '/play', icon: Gamepad2, labelKey: 'tab_play' },
  { path: '/pairing', icon: GitCompare, labelKey: 'tab_pairing' },
  { path: '/perception', icon: Eye, labelKey: 'tab_perception' },
];

export default function Layout() {
  const { lang, toggleLang } = useLangStore();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => navigate('/personality')}
            >
              <h1 className="text-xl font-bold text-primary-700">P&P</h1>
              <img src="/thumb_ryan.png" alt="Ryan" className="w-7 h-7 object-contain" />
              <span className="text-xs text-gray-400 hidden sm:inline">(made by Ryan_Jeong)</span>
            </div>
            <button
              onClick={toggleLang}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 hover:border-primary-400 transition-colors"
            >
              <span className={lang === 'kr' ? 'text-primary-700 font-semibold' : 'text-gray-400'}>
                Korean
              </span>
              <span className="text-gray-300 mx-0.5">|</span>
              <span className={lang === 'en' ? 'text-primary-700 font-semibold' : 'text-gray-400'}>
                English
              </span>
            </button>
          </div>

          {/* Tabs */}
          <nav className="flex gap-1 -mb-px">
            {tabs.map(({ path, icon: Icon, labelKey }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-primary-600 text-primary-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`
                }
              >
                <Icon size={16} />
                {t(lang, labelKey)}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
