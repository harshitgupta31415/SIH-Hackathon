import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const ROLES = [
  { value: 'volunteer', label: 'Community Volunteer' },
  { value: 'asha_worker', label: 'ASHA Worker' },
  { value: 'block_officer', label: 'Block Health Officer' },
  { value: 'district_admin', label: 'District Admin' },
];

const DISTRICTS = [
  'Kamrup', 'Kamrup Metro', 'Nagaon', 'Sonitpur', 'Dibrugarh',
  'Jorhat', 'Sivasagar', 'Cachar', 'Karimganj', 'Hailakandi',
  'Lakhimpur', 'Dhemaji', 'Tinsukia', 'Golaghat', 'Morigaon',
];

export default function Register() {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '',
    role: 'volunteer', village: '', block: '', district: 'Kamrup', state: 'Assam',
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
          <p className="text-slate-600 mt-2">Create your account</p>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">Register</h2>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input name="name" value={form.name} onChange={handleChange} className="input" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input name="email" type="email" value={form.email} onChange={handleChange} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input name="phone" type="tel" value={form.phone} onChange={handleChange} className="input" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input name="password" type="password" value={form.password} onChange={handleChange} className="input" required minLength={8} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <select name="role" value={form.role} onChange={handleChange} className="input">
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">District</label>
                <select name="district" value={form.district} onChange={handleChange} className="input">
                  {DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Block</label>
                <input name="block" value={form.block} onChange={handleChange} className="input" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Village</label>
              <input name="village" value={form.village} onChange={handleChange} className="input" />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-600 mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
