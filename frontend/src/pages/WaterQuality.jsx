import { useState, useEffect } from 'react';
import api from '../utils/api';

const WATER_PARAMS = [
  { key: 'ph_level', label: 'pH Level', min: 0, max: 14, unit: '', ideal: '6.5 - 8.5', icon: '🔬' },
  { key: 'turbidity', label: 'Turbidity', min: 0, max: 50, unit: 'NTU', ideal: '< 5', icon: '🌫️' },
  { key: 'coliform_count', label: 'Coliform Count', min: 0, max: 1000, unit: 'CFU/100ml', ideal: '< 10', icon: '🦠' },
  { key: 'dissolved_oxygen', label: 'Dissolved Oxygen', min: 0, max: 20, unit: 'mg/L', ideal: '> 5', icon: '💨' },
  { key: 'nitrate_level', label: 'Nitrate Level', min: 0, max: 100, unit: 'mg/L', ideal: '< 10', icon: '⚗️' },
];

const SOURCE_TYPES = [
  { value: 'well', label: 'Well' },
  { value: 'river', label: 'River' },
  { value: 'tap', label: 'Tap' },
  { value: 'pond', label: 'Pond' },
  { value: 'rainwater', label: 'Rainwater' },
  { value: 'other', label: 'Other' },
];

export default function WaterQuality() {
  const [records, setRecords] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    source_type: 'well',
    test_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    api.get('/water-quality')
      .then(({ data }) => setRecords(data))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        village_id: '00000000-0000-0000-0000-000000000001',
        source_type: form.source_type,
        test_date: form.test_date,
        latitude: 26.1445,
        longitude: 91.7362,
        notes: form.notes,
      };
      WATER_PARAMS.forEach((p) => {
        if (form[p.key]) payload[p.key] = parseFloat(form[p.key]);
      });

      const { data } = await api.post('/water-quality', payload);
      setRecords((prev) => [data, ...prev]);
      setShowForm(false);
      setForm({ source_type: 'well', test_date: new Date().toISOString().split('T')[0], notes: '' });
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Water Quality</h1>
          <p className="text-slate-500">Monitor and test water sources</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? 'Cancel' : '+ New Test'}
        </button>
      </div>

      {/* Submission Form */}
      {showForm && (
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Submit Water Test Result</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Source Type</label>
                <select
                  value={form.source_type}
                  onChange={(e) => setForm({ ...form, source_type: e.target.value })}
                  className="input"
                >
                  {SOURCE_TYPES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Test Date</label>
                <input
                  type="date"
                  value={form.test_date}
                  onChange={(e) => setForm({ ...form, test_date: e.target.value })}
                  className="input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {WATER_PARAMS.map((param) => (
                <div key={param.key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <span className="mr-1">{param.icon}</span>
                    {param.label}
                    <span className="text-xs text-slate-400 ml-1">(ideal: {param.ideal})</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min={param.min}
                      max={param.max}
                      value={form[param.key] || ''}
                      onChange={(e) => setForm({ ...form, [param.key]: e.target.value })}
                      className="input pr-12"
                      placeholder={`0 - ${param.max}`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      {param.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Submitting...' : 'Submit Test Result'}
            </button>
          </form>
        </div>
      )}

      {/* Records List */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading...</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No water quality records yet</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Source</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">pH</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Turbidity</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Coliform</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Status</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 capitalize font-medium">{r.source_type}</td>
                  <td className="px-4 py-3 text-slate-600">{r.ph_level ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{r.turbidity ?? '-'} NTU</td>
                  <td className="px-4 py-3 text-slate-600">{r.coliform_count ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.is_contaminated ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {r.is_contaminated ? 'Contaminated' : 'Safe'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {new Date(r.test_date).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
