import {
  Radar,
  RadarChart as ReRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import { traitInfo } from '../i18n/texts';
import useLangStore from '../store/langStore';

const TRAIT_ORDER = ['O', 'C', 'E', 'A', 'N'];

export default function RadarChart({ scores }) {
  const { lang } = useLangStore();
  const info = traitInfo[lang] || traitInfo.en;

  const data = TRAIT_ORDER.filter((k) => k in scores).map((k) => ({
    trait: info[k].name,
    value: scores[k],
    fullMark: 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ReRadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis dataKey="trait" tick={{ fontSize: 12, fill: '#4b5563' }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
        <Radar
          dataKey="value"
          stroke="#6366f1"
          fill="#6366f1"
          fillOpacity={0.15}
          strokeWidth={2}
        />
      </ReRadarChart>
    </ResponsiveContainer>
  );
}
