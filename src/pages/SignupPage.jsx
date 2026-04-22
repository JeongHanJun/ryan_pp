import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useLangStore from '../store/langStore';
import { t } from '../i18n/texts';

const currentYear = new Date().getFullYear();

export default function SignupPage() {
  const { signup } = useAuthStore();
  const { lang } = useLangStore();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [region, setRegion] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== passwordConfirm) {
      setError(t(lang, 'pw_mismatch'));
      return;
    }
    if (password.length < 8) {
      setError(lang === 'kr' ? '비밀번호는 8자 이상이어야 합니다.' : 'Password must be at least 8 characters.');
      return;
    }
    const by = parseInt(birthYear, 10);
    if (!by || by < 1900 || by > currentYear) {
      setError(lang === 'kr' ? '올바른 출생년도를 입력해주세요.' : 'Please enter a valid birth year.');
      return;
    }
    if (!displayName.trim()) {
      setError(lang === 'kr' ? '닉네임을 입력해주세요.' : 'Please enter a display name.');
      return;
    }

    setLoading(true);
    try {
      await signup({
        email: email.trim().toLowerCase(),
        password,
        display_name: displayName.trim(),
        birth_year: by,
        region: region.trim() || null,
      });
      navigate('/popular', { replace: true });
    } catch (err) {
      if (err.response?.status === 409) {
        setError(t(lang, 'email_exists'));
      } else {
        setError(t(lang, 'error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm card">
        <h1 className="text-2xl font-bold mb-1 text-center">
          {t(lang, 'app_title')}
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          {t(lang, 'signup_title')}
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
            autoComplete="new-password"
            placeholder={t(lang, 'password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
          />
          <input
            type="password"
            required
            autoComplete="new-password"
            placeholder={t(lang, 'password_confirm')}
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
          />
          <input
            type="text"
            required
            maxLength={40}
            placeholder={lang === 'kr' ? '닉네임 (랭킹에 공개됩니다)' : 'Display name (shown on rankings)'}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
          />
          <input
            type="number"
            required
            min={1900}
            max={currentYear}
            placeholder={t(lang, 'birth_year')}
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
          />
          <input
            type="text"
            maxLength={64}
            placeholder={`${t(lang, 'region')} (${lang === 'kr' ? '선택' : 'optional'})`}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
          />

          {error && (
            <div className="p-2 bg-red-50 text-red-700 text-sm rounded-md">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? '…' : t(lang, 'signup_btn')}
          </button>
        </form>

        <div className="mt-4 text-sm text-center text-gray-500">
          {t(lang, 'go_login')}{' '}
          <Link to="/login" className="text-primary-600 font-medium hover:underline">
            {t(lang, 'login_btn')}
          </Link>
        </div>
      </div>
    </div>
  );
}
