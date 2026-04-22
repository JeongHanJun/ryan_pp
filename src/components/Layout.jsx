import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Brain, Users, Gamepad2, GitCompare, Eye, TrendingUp,
  LogIn, UserPlus, LogOut, ChevronDown,
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import useLangStore from '../store/langStore';
import { t } from '../i18n/texts';

// Tabs visible to guests (not logged in).
const GUEST_TABS = [
  { path: '/personality', icon: Brain, labelKey: 'tab_personality' },
  { path: '/play', icon: Gamepad2, labelKey: 'tab_play' },
];

// Tabs visible after login. "Popular" comes first so it's the landing.
const AUTH_TABS = [
  { path: '/popular', icon: TrendingUp, labelKey: 'tab_popular' },
  { path: '/personality', icon: Brain, labelKey: 'tab_personality' },
  { path: '/persona', icon: Users, labelKey: 'tab_persona' },
  { path: '/play', icon: Gamepad2, labelKey: 'tab_play' },
  { path: '/pairing', icon: GitCompare, labelKey: 'tab_pairing' },
  { path: '/perception', icon: Eye, labelKey: 'tab_perception' },
];

function UserMenu({ user, onLogout, lang }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClickAway = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 hover:border-primary-400 transition-colors"
      >
        <span className="truncate max-w-[140px]">{user.display_name}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-100 truncate">
            {user.email}
          </div>
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <LogOut size={14} /> {t(lang, 'logout')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { lang, toggleLang } = useLangStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const tabs = user ? AUTH_TABS : GUEST_TABS;
  const homePath = user ? '/popular' : '/personality';

  const handleLogout = () => {
    logout();
    navigate('/personality', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => navigate(homePath)}
            >
              <h1 className="text-xl font-bold text-primary-700">P&P</h1>
              <img src="./thumb_ryan.png" alt="Ryan" className="w-7 h-7 object-contain" />
              <span className="text-xs text-gray-400 hidden sm:inline">(made by Ryan_Jeong)</span>
            </div>

            <div className="flex items-center gap-2">
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

              {user ? (
                <UserMenu user={user} onLogout={handleLogout} lang={lang} />
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => navigate('/login')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:text-primary-700 transition-colors"
                  >
                    <LogIn size={14} /> {t(lang, 'login_btn')}
                  </button>
                  <button
                    onClick={() => navigate('/signup')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white transition-colors"
                  >
                    <UserPlus size={14} /> {t(lang, 'signup_btn')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {tabs.map(({ path, icon: Icon, labelKey }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
