import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';

const SYMPTOMS = [
  { id: 'diarrhea', label: 'Diarrhea', icon: '🤢' },
  { id: 'vomiting', label: 'Vomiting', icon: '🤮' },
  { id: 'fever', label: 'Fever', icon: '🤒' },
  { id: 'cholera', label: 'Cholera-like', icon: '💧' },
  { id: 'typhoid', label: 'Typhoid', icon: '🤕' },
  { id: 'hepatitis', label: 'Hepatitis', icon: '🫁' },
];

const WATER_SOURCES = [
  { value: 'well', label: 'Well' },
  { value: 'river', label: 'River' },
  { value: 'tap', label: 'Tap Water' },
  { value: 'pond', label: 'Pond' },
  { value: 'rainwater', label: 'Rainwater' },
  { value: 'other', label: 'Other' },
];

export default function ReportForm() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [location, setLocation] = useState({ latitude: null, longitude: null });
  const [form, setForm] = useState({
    disease_type: '',
    symptoms: [],
    cases_count: 1,
    severity: 'moderate',
    water_source: '',
    notes: '',
    village_id: '',
  });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => setLocation({ latitude: 26.1445, longitude: 91.7362 })
      );
    }
  }, []);

  const toggleSymptom = (id) => {
    setForm((prev) => ({
      ...prev,
      symptoms: prev.symptoms.includes(id)
        ? prev.symptoms.filter((s) => s !== id)
        : [...prev.symptoms, id],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.symptoms.length) {
      setError('Select at least one symptom');
      return;
    }
    if (!form.disease_type) {
      setError('Enter the disease type');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.post('/reports', {
        ...form,
        village_id: form.village_id || '00000000-0000-0000-0000-000000000001',
        latitude: location.latitude || 26.1445,
        longitude: location.longitude || 91.7362,
      });
      navigate('/reports');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">New Health Report</h1>
      <p className="text-slate-500 mb-6">Report symptoms observed in your community</p>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Disease Type */}
        <div className="card p-4">
          <label className="block text-sm font-semibold text-slate-900 mb-2">Disease Type *</label>
          <input
            type="text"
            value={form.disease_type}
            onChange={(e) => setForm({ ...form, disease_type: e.target.value })}
            className="input"
            placeholder="e.g., Cholera, Typhoid, Diarrhea"
            required
          />
        </div>

        {/* Symptoms - Large Tap Targets */}
        <div className="card p-4">
          <label className="block text-sm font-semibold text-slate-900 mb-3">Symptoms Observed *</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {SYMPTOMS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleSymptom(s.id)}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  form.symptoms.includes(s.id)
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="text-3xl block mb-1">{s.icon}</span>
                <span className="text-sm font-medium">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Cases Count & Severity */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-4">
            <label className="block text-sm font-semibold text-slate-900 mb-2">Number of Cases *</label>
            <input
              type="number"
              min="1"
              max="500"
              value={form.cases_count}
              onChange={(e) => setForm({ ...form, cases_count: parseInt(e.target.value) })}
              className="input text-center text-lg font-bold"
            />
          </div>
          <div className="card p-4">
            <label className="block text-sm font-semibold text-slate-900 mb-2">Severity</label>
            <select
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
              className="input"
            >
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        {/* Water Source */}
        <div className="card p-4">
          <label className="block text-sm font-semibold text-slate-900 mb-2">Water Source Used</label>
          <div className="flex flex-wrap gap-2">
            {WATER_SOURCES.map((ws) => (
              <button
                key={ws.value}
                type="button"
                onClick={() => setForm({ ...form, water_source: ws.value })}
                className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                  form.water_source === ws.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {ws.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="card p-4">
          <label className="block text-sm font-semibold text-slate-900 mb-2">Additional Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="input min-h-[80px]"
            placeholder="Any additional observations..."
          />
        </div>

        {/* Location Status */}
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${location.latitude ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <div>
              <p className="text-sm font-medium text-slate-900">
                {location.latitude ? 'Location detected' : 'Getting location...'}
              </p>
              {location.latitude && (
                <p className="text-xs text-slate-500">
                  {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                </p>
              )}
            </div>
          </div>
        </div>

        <button type="submit" disabled={submitting} className="btn-primary w-full py-3 text-base">
          {submitting ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>
    </div>
  );
}
