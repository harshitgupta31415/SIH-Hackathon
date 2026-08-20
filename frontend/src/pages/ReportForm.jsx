import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useTranslation } from '../i18n/LanguageContext';

export default function ReportForm() {
  const { t } = useTranslation();

  const SYMPTOMS = [
    { id: 'diarrhea', label: t('symptom.diarrhea'), icon: '🤢' },
    { id: 'vomiting', label: t('symptom.vomiting'), icon: '🤮' },
    { id: 'fever', label: t('symptom.fever'), icon: '🤒' },
    { id: 'cholera', label: t('symptom.cholera'), icon: '💧' },
    { id: 'typhoid', label: t('symptom.typhoid'), icon: '🤕' },
    { id: 'hepatitis', label: t('symptom.hepatitis'), icon: '🫁' },
  ];

  const WATER_SOURCES = [
    { value: 'well', label: t('waterSource.well') },
    { value: 'river', label: t('waterSource.river') },
    { value: 'tap', label: t('waterSource.tap') },
    { value: 'pond', label: t('waterSource.pond') },
    { value: 'rainwater', label: t('waterSource.rainwater') },
    { value: 'other', label: t('waterSource.other') },
  ];

  const SEVERITY_OPTIONS = [
    { value: 'mild', label: t('severity.mild') },
    { value: 'moderate', label: t('severity.moderate') },
    { value: 'severe', label: t('severity.severe') },
    { value: 'critical', label: t('severity.critical') },
  ];

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
      .catch(() => setVillagesError(t('reportForm.villagesLoadError')))
      .finally(() => setVillagesLoading(false));
  }, [t]);

  useEffect(() => {
    loadVillages();
  }, [loadVillages]);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocation((current) => ({ ...current, error: t('reportForm.noGeolocation') }));
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
            error: t('reportForm.geocodeFailed'),
          });
        }
      },
      (positionError) => {
        const message = positionError.code === 1
          ? t('reportForm.geolocationDenied')
          : t('reportForm.geolocationError');
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
    if (!form.symptoms.length) return setError(t('reportForm.symptomError'));
    if (!form.disease_type) return setError(t('reportForm.diseaseError'));
    if (!form.village_id) return setError(t('reportForm.villageError'));

    const selectedVillage = villages.find((village) => village.id === form.village_id);
    const latitude = location.latitude ?? selectedVillage?.latitude;
    const longitude = location.longitude ?? selectedVillage?.longitude;
    if (latitude == null || longitude == null) {
      return setError(t('reportForm.locationError'));
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.post('/reports', { ...form, latitude, longitude });
      navigate('/reports');
    } catch (requestError) {
      setError(requestError.response?.data?.detail || t('reportForm.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">{t('reportForm.title')}</h1>
      <p className="text-slate-500 mb-6">{t('reportForm.subtitle')}</p>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm mb-4">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{t('reportForm.location')}</h2>
              <p className="mt-1 text-sm text-slate-500">{t('reportForm.locationDesc')}</p>
            </div>
            <button type="button" onClick={requestLocation} disabled={location.loading} className="btn-secondary shrink-0">
              {location.loading ? t('reportForm.finding') : t('reportForm.useMyLocation')}
            </button>
          </div>
          {location.address && <p className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-800">{location.address}</p>}
          {location.error && <p className="mt-3 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">{location.error}</p>}
          {location.latitude != null && <p className="mt-2 text-xs text-slate-500">{t('reportForm.coordinates')} {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</p>}
        </div>

        <div className="card p-4">
          <label className="block text-sm font-semibold text-slate-900 mb-2">{t('reportForm.village')}</label>
          <select value={form.village_id} onChange={(event) => setForm({ ...form, village_id: event.target.value })} className="input" required disabled={villagesLoading}>
            <option value="">{villagesLoading ? t('reportForm.loadingVillages') : t('reportForm.selectVillage')}</option>
            {villages.map((village) => <option key={village.id} value={village.id}>{village.name} — {village.block}</option>)}
          </select>
          {villagesError && (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-md bg-red-50 p-2 text-sm text-red-700">
              <span>{villagesError}</span>
              <button type="button" onClick={loadVillages} className="font-medium underline">{t('reportForm.retry')}</button>
            </div>
          )}
          {location.latitude != null && form.village_id && <p className="mt-2 text-xs text-green-700">{t('reportForm.autoSelected')}</p>}
        </div>

        <div className="card p-4">
          <label className="block text-sm font-semibold text-slate-900 mb-2">{t('reportForm.diseaseType')}</label>
          <input type="text" value={form.disease_type} onChange={(event) => setForm({ ...form, disease_type: event.target.value })} className="input" placeholder={t('reportForm.diseasePlaceholder')} required />
        </div>

        <div className="card p-4">
          <label className="block text-sm font-semibold text-slate-900 mb-3">{t('reportForm.symptoms')}</label>
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
            <label className="block text-sm font-semibold text-slate-900 mb-2">{t('reportForm.casesCount')}</label>
            <input type="number" min="1" max="500" value={form.cases_count} onChange={(event) => setForm({ ...form, cases_count: Number(event.target.value) })} className="input text-center text-lg font-bold" />
          </div>
          <div className="card p-4">
            <label className="block text-sm font-semibold text-slate-900 mb-2">{t('reportForm.severity')}</label>
            <select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value })} className="input">
              {SEVERITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </div>

        <div className="card p-4">
          <label className="block text-sm font-semibold text-slate-900 mb-2">{t('reportForm.waterSource')}</label>
          <div className="flex flex-wrap gap-2">
            {WATER_SOURCES.map((source) => <button key={source.value} type="button" onClick={() => setForm({ ...form, water_source: source.value })} className={`px-4 py-2 rounded-full text-sm border transition-colors ${form.water_source === source.value ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>{source.label}</button>)}
          </div>
        </div>

        <div className="card p-4">
          <label className="block text-sm font-semibold text-slate-900 mb-2">{t('reportForm.notes')}</label>
          <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="input min-h-[80px]" placeholder={t('reportForm.notesPlaceholder')} />
        </div>

        <button type="submit" disabled={submitting} className="btn-primary w-full py-3 text-base">{submitting ? t('reportForm.submitting') : t('reportForm.submitReport')}</button>
      </form>
    </div>
  );
}
