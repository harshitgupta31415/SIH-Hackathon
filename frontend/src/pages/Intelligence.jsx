import { useEffect, useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../utils/api';
import { useAuthStore } from '../store/authStore';

const DISEASES = ['Diarrhea', 'Cholera', 'Typhoid', 'Hepatitis A', 'Dysentery'];

const RISK_STYLES = {
  low: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  critical: 'bg-red-100 text-red-800 border-red-200',
};

const titleCase = (value = '') => value.charAt(0).toUpperCase() + value.slice(1);

export default function Intelligence() {
  const { user } = useAuthStore();
  const [disease, setDisease] = useState('Diarrhea');
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionState, setActionState] = useState('');

  const loadPrediction = async () => {
    if (!user?.district) return;
    setLoading(true);
    setError('');
    setActionState('');
    try {
      const { data } = await api.get(`/dashboard/predictions/${encodeURIComponent(user.district)}/${encodeURIComponent(disease)}`);
      setPrediction(data);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to generate an outbreak forecast right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrediction();
  }, [disease, user?.district]);

  const forecastChart = useMemo(() => {
    const dailyTotals = [];
    (prediction?.village_forecasts || []).forEach((village) => {
      village.forecast_series.forEach((cases, index) => {
        dailyTotals[index] = (dailyTotals[index] || 0) + cases;
      });
    });
    return dailyTotals.map((cases, index) => ({ day: `Day ${index + 1}`, cases: Math.round(cases * 10) / 10 }));
  }, [prediction]);

  const createAlert = async () => {
    if (!prediction) return;
    setActionState('Creating district alert...');
    const highestRiskVillage = prediction.village_forecasts?.slice().sort((a, b) => b.risk_score - a.risk_score)[0];
    try {
      await api.post('/alerts', {
        title: `${titleCase(prediction.risk_level)} ${disease} early-warning alert`,
        message: `Jal Jeevan Swasthya projects ${prediction.predicted_cases} cases over the next 14 days. ${prediction.explanation.risk_drivers.map((driver) => driver.label).join('; ')}.`,
        severity: prediction.risk_level,
        affected_area: highestRiskVillage?.village_name || user.district,
        district: user.district,
        villages: prediction.factors.high_risk_villages.map((village) => village.village),
        predicted_cases: Math.round(prediction.predicted_cases),
        recommended_action: prediction.explanation.recommended_actions.join(' '),
      });
      setActionState('Alert created. The response team can now see it on the Alerts page.');
    } catch (requestError) {
      setActionState(requestError.response?.data?.detail || 'Could not create the alert.');
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Analysing reports, water tests, and village data...</div>;

  const explanation = prediction?.explanation;
  const riskStyle = RISK_STYLES[prediction?.risk_level] || RISK_STYLES.low;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-slate-950 via-blue-950 to-cyan-900 p-6 text-white shadow-lg">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-cyan-200">Jal Jeevan Swasthya early-warning engine</p>
            <h1 className="mt-2 text-3xl font-bold">Outbreak Intelligence</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200">Transforms field reports and water-quality checks into a 14-day, explainable district forecast, then lets officials create a verified response alert.</p>
          </div>
          <label className="block text-sm font-medium text-slate-100">
            Disease to monitor
            <select value={disease} onChange={(event) => setDisease(event.target.value)} className="mt-1 block w-48 rounded-lg border border-slate-500 bg-slate-900 px-3 py-2 text-white">
              {DISEASES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </section>

      {error && <div className="rounded-lg bg-red-50 p-4 text-red-700">{error}</div>}
      {prediction && explanation && (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <div className="card p-5 md:col-span-2">
              <p className="text-sm font-medium text-slate-500">Predicted {disease} cases - next 14 days</p>
              <p className="mt-1 text-5xl font-bold text-slate-900">{prediction.predicted_cases}</p>
              <p className="mt-2 text-sm text-slate-500">Across {prediction.factors.total_villages_assessed} monitored villages in {user?.district}</p>
            </div>
            <div className={`card border p-5 ${riskStyle}`}>
              <p className="text-sm font-medium">Risk level</p>
              <p className="mt-1 text-3xl font-bold">{titleCase(prediction.risk_level)}</p>
              <p className="mt-2 text-sm">Review window: 14 days</p>
            </div>
            <div className="card p-5">
              <p className="text-sm font-medium text-slate-500">Forecast confidence</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{Math.round(prediction.confidence * 100)}%</p>
              <p className="mt-2 text-sm text-slate-500">Data maturity: {titleCase(explanation.data_status)}</p>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-5">
            <div className="card p-5 lg:col-span-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-slate-900">14-day case forecast</h2>
                  <p className="text-sm text-slate-500">Combined village forecast; model method: {prediction.factors.models_used.join(', ')}</p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{explanation.reports_used_last_120_days} reports used</span>
              </div>
              <div className="mt-5 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={forecastChart}><XAxis dataKey="day" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="cases" name="Predicted cases" stroke="#2563eb" strokeWidth={3} dot={false} /></LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card p-5 lg:col-span-2">
              <h2 className="font-semibold text-slate-900">Why this risk level?</h2>
              <div className="mt-4 space-y-3">
                {explanation.risk_drivers.map((driver) => <div key={driver.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3"><p className="text-sm font-medium text-slate-800">{driver.label}</p><p className="mt-1 text-xs text-slate-500">Source: {driver.source}</p></div>)}
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-5">
            <div className="card p-5 lg:col-span-3">
              <h2 className="font-semibold text-slate-900">Village-level early warnings</h2>
              <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-slate-500"><tr><th className="pb-2">Village</th><th className="pb-2">14-day cases</th><th className="pb-2">Trend</th><th className="pb-2">Risk score</th></tr></thead><tbody>{prediction.village_forecasts.slice().sort((a, b) => b.risk_score - a.risk_score).map((village) => <tr key={village.village_id} className="border-b border-slate-100"><td className="py-3 font-medium text-slate-800">{village.village_name}</td><td className="py-3">{village.next_14_total}</td><td className="py-3 capitalize">{village.trend}</td><td className="py-3 font-semibold">{village.risk_score}/100</td></tr>)}</tbody></table></div>
            </div>
            <div className="card p-5 lg:col-span-2">
              <h2 className="font-semibold text-slate-900">Recommended response</h2>
              <ol className="mt-4 space-y-3 text-sm text-slate-700">{explanation.recommended_actions.map((action, index) => <li key={action} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{index + 1}</span><span>{action}</span></li>)}</ol>
              <button type="button" onClick={createAlert} className="btn-primary mt-5 w-full">Create response alert</button>
              {actionState && <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{actionState}</p>}
            </div>
          </section>
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Human review required:</strong> {explanation.disclaimer}</p>
        </>
      )}
    </div>
  );
}
