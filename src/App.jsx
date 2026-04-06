import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import PersonalityPage from './pages/PersonalityPage';
import PersonaPage from './pages/PersonaPage';
import PlayPage from './pages/PlayPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/personality" element={<PersonalityPage />} />
        <Route path="/persona" element={<PersonaPage />} />
        <Route path="/play" element={<PlayPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/personality" replace />} />
    </Routes>
  );
}
