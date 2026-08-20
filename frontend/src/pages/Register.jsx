import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../i18n/LanguageContext';

const DISTRICTS = [
  'Kamrup', 'Kamrup Metro', 'Nagaon', 'Sonitpur', 'Dibrugarh',
  'Jorhat', 'Sivasagar', 'Cachar', 'Karimganj', 'Hailakandi',
  'Lakhimpur', 'Dhemaji', 'Tinsukia', 'Golaghat', 'Morigaon',
];

export default function Register() {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '',
    village: '', block: '', district: 'Kamrup', state: 'Assam',
  });
  const { register, loading, error } = useAuthStore();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await register(form);
      navigate('/');
    } catch {}
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 py-8">
      <div className="w-full max-w-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">🏥 HealthWatch NE</h1>
          <p className="text-slate-600 mt-2">{t('register.createAccount')}</p>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">{t('register.title')}</h2>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('register.fullName')}</label>
              <input name="name" value={form.name} onChange={handleChange} className="input" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('register.email')}</label>
                <input name="email" type="email" value={form.email} onChange={handleChange} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('register.phone')}</label>
                <input name="phone" type="tel" value={form.phone} onChange={handleChange} className="input" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('register.password')}</label>
              <input name="password" type="password" value={form.password} onChange={handleChange} className="input" required minLength={8} />
            </div>

            <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">
              {t('register.info')}
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('register.district')}</label>
                <select name="district" value={form.district} onChange={handleChange} className="input">
                  {DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('register.block')}</label>
                <input name="block" value={form.block} onChange={handleChange} className="input" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('register.village')}</label>
              <input name="village" value={form.village} onChange={handleChange} className="input" />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? t('register.submitting') : t('register.submit')}
            </button>
          </form>

          <p className="text-center text-sm text-slate-600 mt-4">
            {t('register.hasAccount')}{' '}
            <Link to="/login" className="text-blue-600 hover:underline">{t('register.signIn')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}