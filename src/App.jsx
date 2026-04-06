import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import PersonalityPage from './pages/PersonalityPage';
import PersonaPage from './pages/PersonaPage';
import PlayPage from './pages/PlayPage';
import PreferencePage from './pages/PreferencePage';
import AptitudePage from './pages/AptitudePage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/personality" element={<PersonalityPage />} />
        <Route path="/persona" element={<PersonaPage />} />
        <Route path="/play" element={<PlayPage />} />
        <Route path="/aptitude" element={<AptitudePage />} />
        <Route path="/preference" element={<PreferencePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/personality" replace />} />
    </Routes>
  );
}
