import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useLangStore from '../store/langStore';
import { t } from '../i18n/texts';

export default function LoginPage() {
  const { login } = useAuthStore();
  const { lang } = useLangStore();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      navigate('/popular', { replace: true });
    } catch (err) {
      setError(t(lang, 'auth_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm card">
        <h1 className="text-2xl font-bold mb-1 text-center">
          {t(lang, 'app_title')}
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          {t(lang, 'login_title')}
        </p>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder={t(lang, 'email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder={t(lang, 'password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
          />

          {error && (
            <div className="p-2 bg-red-50 text-red-700 text-sm rounded-md">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? '…' : t(lang, 'login_btn')}
          </button>
        </form>

        <div className="mt-4 text-sm text-center text-gray-500">
          {t(lang, 'go_signup')}{' '}
          <Link to="/signup" className="text-primary-600 font-medium hover:underline">
            {t(lang, 'signup_btn')}
          </Link>
        </div>

        <div className="mt-2 text-xs text-center text-gray-400">
          <Link to="/personality" className="hover:underline">
            {lang === 'kr' ? '로그인 없이 둘러보기' : 'Continue as guest'}
          </Link>
        </div>
      </div>
    </div>
  );
}
