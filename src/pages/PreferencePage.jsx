import { BarChart3 } from 'lucide-react';
import useLangStore from '../store/langStore';
import { t } from '../i18n/texts';

export default function PreferencePage() {
  const { lang } = useLangStore();
  return (
    <div className="text-center py-20">
      <BarChart3 size={48} className="mx-auto text-gray-300 mb-4" />
      <h2 className="text-xl font-bold mb-2">{t(lang, 'pref_title')}</h2>
      <p className="text-gray-500">{t(lang, 'pref_coming')}</p>
    </div>
  );
}
