import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import PopularPage from './pages/PopularPage';
import PersonalityPage from './pages/PersonalityPage';
import PersonaPage from './pages/PersonaPage';
import PlayPage from './pages/PlayPage';
import PairingPage from './pages/PairingPage';
import PerceptionPage from './pages/PerceptionPage';

function HomeRedirect() {
  const { user, booted } = useAuthStore();
  if (!booted) return null;
  return <Navigate to={user ? '/popular' : '/personality'} replace />;
}

export default function App() {
  const loadUser = useAuthStore((s) => s.loadUser);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      <Route element={<Layout />}>
        {/* Guest-accessible */}
        <Route path="/personality" element={<PersonalityPage />} />
        <Route path="/play" element={<PlayPage />} />

        {/* Auth-only */}
        <Route
          path="/popular"
          element={<ProtectedRoute><PopularPage /></ProtectedRoute>}
        />
        <Route
          path="/persona"
          element={<ProtectedRoute><PersonaPage /></ProtectedRoute>}
        />
        <Route
          path="/pairing"
          element={<ProtectedRoute><PairingPage /></ProtectedRoute>}
        />
        <Route
          path="/perception"
          element={<ProtectedRoute><PerceptionPage /></ProtectedRoute>}
        />
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
