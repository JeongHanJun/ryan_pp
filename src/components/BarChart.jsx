import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { traitInfo } from '../i18n/texts';
import useLangStore from '../store/langStore';

const TRAIT_ORDER = ['O', 'C', 'E', 'A', 'N'];
const SCORE_HIGH = 65;
const SCORE_LOW = 35;

function getColor(v) {
  if (v >= SCORE_HIGH) return '#22c55e';
  if (v >= SCORE_LOW) return '#6366f1';
  return '#ef4444';
}

export default function HBarChart({ scores }) {
  const { lang } = useLangStore();
  const info = traitInfo[lang] || traitInfo.en;

  const data = TRAIT_ORDER.filter((k) => k in scores).map((k) => ({
    name: `${info[k].icon} ${info[k].name}`,
    value: Math.round(scores[k] * 10) / 10,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ReBarChart data={data} layout="vertical" margin={{ left: 10, right: 50, top: 10, bottom: 10 }}>
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28}>
          {data.map((entry, i) => (
            <Cell key={i} fill={getColor(entry.value)} />
          ))}
          <LabelList dataKey="value" position="right" style={{ fontSize: 12, fontWeight: 600 }} />
        </Bar>
      </ReBarChart>
    </ResponsiveContainer>
  );
}
