import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [location, setLocation] = useState({
    latitude: null, longitude: null, address: null, loading: false, error: null,
  });
  const [villages, setVillages] = useState([]);
  const [villagesLoading, setVillagesLoading] = useState(true);
  const [villagesError, setVillagesError] = useState(null);
  const [form, setForm] = useState({
    disease_type: '', symptoms: [], cases_count: 1, severity: 'moderate',
    water_source: '', notes: '', village_id: '',
  });

  const loadVillages = useCallback(() => {
    setVillagesLoading(true);
    setVillagesError(null);
    api.get('/villages')
      .then(({ data }) => setVillages(data))
      .catch(() => setVillagesError('Unable to load villages. Check that the API is running, then retry.'))
      .finally(() => setVillagesLoading(false));
  }, []);

  useEffect(() => {
    loadVillages();
  }, [loadVillages]);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocation((current) => ({ ...current, error: 'This browser does not support location access.' }));
      return;
    }

    setLocation((current) => ({ ...current, loading: true, error: null }));
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        try {
          const { data } = await api.get('/locations/reverse', { params: { latitude, longitude } });
          setLocation({ latitude, longitude, address: data.address, loading: false, error: null });
          if (data.nearest_village) {
            setForm((current) => ({ ...current, village_id: data.nearest_village.id }));
          }
        } catch {
          setLocation({
            latitude, longitude, address: null, loading: false,
            error: 'Location found, but its address could not be resolved. You can still select a village manually.',
          });
        }
      },
      (positionError) => {
        const message = positionError.code === 1
          ? 'Location permission was denied. Select the village manually instead.'
          : 'Unable to get your location. Select the village manually instead.';
        setLocation((current) => ({ ...current, loading: false, error: message }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  };

  const toggleSymptom = (id) => {
    setForm((current) => ({
      ...current,
      symptoms: current.symptoms.includes(id)
        ? current.symptoms.filter((symptom) => symptom !== id)
        : [...current.symptoms, id],
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.symptoms.length) return setError('Select at least one symptom');
    if (!form.disease_type) return setError('Enter the disease type');
    if (!form.village_id) return setError('Select the village where cases were observed');

    const selectedVillage = villages.find((village) => village.id === form.village_id);
    const latitude = location.latitude ?? selectedVillage?.latitude;
    const longitude = location.longitude ?? selectedVillage?.longitude;
    if (latitude == null || longitude == null) {
      return setError('Use your location or select a village with saved coordinates before submitting.');
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.post('/reports', { ...form, latitude, longitude });
      navigate('/reports');
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">New Health Report</h1>
      <p className="text-slate-500 mb-6">Report symptoms observed in your community</p>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm mb-4">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Report location</h2>
              <p className="mt-1 text-sm text-slate-500">Allow location access to find your address and suggest the nearest monitored village.</p>
            </div>
            <button type="button" onClick={requestLocation} disabled={location.loading} className="btn-secondary shrink-0">
              {location.loading ? 'Finding...' : 'Use my location'}
            </button>
          </div>
          {location.address && <p className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-800">{location.address}</p>}
          {location.error && <p className="mt-3 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">{location.error}</p>}
          {location.latitude != null && <p className="mt-2 text-xs text-slate-500">Coordinates: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</p>}
        </div>

        <div className="card p-4">
          <label className="block text-sm font-semibold text-slate-900 mb-2">Village *</label>
          <select value={form.village_id} onChange={(event) => setForm({ ...form, village_id: event.target.value })} className="input" required disabled={villagesLoading}>
            <option value="">{villagesLoading ? 'Loading villages...' : 'Select a village'}</option>
            {villages.map((village) => <option key={village.id} value={village.id}>{village.name} — {village.block}</option>)}
          </select>
          {villagesError && (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-md bg-red-50 p-2 text-sm text-red-700">
              <span>{villagesError}</span>
              <button type="button" onClick={loadVillages} className="font-medium underline">Retry</button>
            </div>
          )}
          {location.latitude != null && form.village_id && <p className="mt-2 text-xs text-green-700">The nearest monitored village was selected. You can change it if needed.</p>}
        </div>

        <div className="card p-4">
          <label className="block text-sm font-semibold text-slate-900 mb-2">Disease Type *</label>
          <input type="text" value={form.disease_type} onChange={(event) => setForm({ ...form, disease_type: event.target.value })} className="input" placeholder="e.g., Cholera, Typhoid, Diarrhea" required />
        </div>

        <div className="card p-4">
          <label className="block text-sm font-semibold text-slate-900 mb-3">Symptoms Observed *</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {SYMPTOMS.map((symptom) => (
              <button key={symptom.id} type="button" onClick={() => toggleSymptom(symptom.id)} className={`p-4 rounded-xl border-2 text-center transition-all ${form.symptoms.includes(symptom.id) ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}>
                <span className="text-3xl block mb-1">{symptom.icon}</span>
                <span className="text-sm font-medium">{symptom.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="card p-4">
            <label className="block text-sm font-semibold text-slate-900 mb-2">Number of Cases *</label>
            <input type="number" min="1" max="500" value={form.cases_count} onChange={(event) => setForm({ ...form, cases_count: Number(event.target.value) })} className="input text-center text-lg font-bold" />
          </div>
          <div className="card p-4">
            <label className="block text-sm font-semibold text-slate-900 mb-2">Severity</label>
            <select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value })} className="input">
              <option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option><option value="critical">Critical</option>
            </select>
          </div>
        </div>

        <div className="card p-4">
          <label className="block text-sm font-semibold text-slate-900 mb-2">Water Source Used</label>
          <div className="flex flex-wrap gap-2">
            {WATER_SOURCES.map((source) => <button key={source.value} type="button" onClick={() => setForm({ ...form, water_source: source.value })} className={`px-4 py-2 rounded-full text-sm border transition-colors ${form.water_source === source.value ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>{source.label}</button>)}
          </div>
        </div>

        <div className="card p-4">
          <label className="block text-sm font-semibold text-slate-900 mb-2">Additional Notes</label>
          <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="input min-h-[80px]" placeholder="Any additional observations..." />
        </div>

        <button type="submit" disabled={submitting} className="btn-primary w-full py-3 text-base">{submitting ? 'Submitting...' : 'Submit Report'}</button>
      </form>
    </div>
  );
}
