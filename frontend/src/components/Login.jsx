import { useState } from 'react';
import InputField from './common/InputField';
import { useAuth } from '../context/AuthContext';

export default function Login({ onNavigateToSignup }) {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (error) setError('');
  };

  const handleQuickFill = (email, password) => {
    setFormData((prev) => ({
      ...prev,
      email,
      password,
    }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await login(formData.email, formData.password);
      setSuccess('Welcome back! Authentication successful.');
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="text-center mb-6">
        <h1 className="text-slate-900 text-2xl font-bold tracking-tight mb-1.5">Welcome Back</h1>
        <p className="text-slate-400 text-sm mb-4">Please enter your credentials to access your account</p>

        <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 mb-2 text-left">
          <h3 className="text-slate-700 text-xs font-bold uppercase tracking-wider mb-2.5">
            Quick-Fill Demo Accounts:
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl py-2 px-3 text-xs font-bold cursor-pointer transition-colors text-center"
              onClick={() => handleQuickFill('admin@assetflow.com', 'admin123')}
            >
              Admin
            </button>
            <button
              type="button"
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl py-2 px-3 text-xs font-bold cursor-pointer transition-colors text-center"
              onClick={() => handleQuickFill('manager@assetflow.com', 'manager123')}
            >
              Asset Manager
            </button>
            <button
              type="button"
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl py-2 px-3 text-xs font-bold cursor-pointer transition-colors text-center"
              onClick={() => handleQuickFill('head@assetflow.com', 'head123')}
            >
              Dept Head
            </button>
            <button
              type="button"
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl py-2 px-3 text-xs font-bold cursor-pointer transition-colors text-center"
              onClick={() => handleQuickFill('priya@assetflow.com', 'employee123')}
            >
              Employee
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200/50 text-red-600 rounded-xl p-3.5 text-xs font-bold text-left mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/50 text-emerald-600 rounded-xl p-3.5 text-xs font-bold text-left mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          {success}
        </div>
      )}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {/* Email Field */}
        <InputField
          label="Email Address"
          id="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="e.g. employee@company.com"
          required
        />

        {/* Password Field */}
        <InputField
          label="Password"
          id="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="••••••••"
          required
        />

        {/* Actions row: Remember Me & Forgot Password */}
        <div className="flex items-center justify-between mt-1 mb-4 text-xs font-semibold">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="rememberMe"
              checked={formData.rememberMe}
              onChange={handleChange}
              className="w-4 h-4 accent-primary border border-slate-300 rounded cursor-pointer"
            />
            <span className="text-slate-600">Remember me</span>
          </label>

          
          <a
            href="#forgot-password"
            className="text-emerald-600 hover:text-emerald-700 transition-colors"
            onClick={(e) => {
              e.preventDefault();
              setError('Password reset link has been requested (Simulated).');
            }}
          >
            Forgot Password?
          </a>
        </div>

        {/* Login Button */}
        <button
          type="submit"
          className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-full flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {loading ? (
            <>
              <svg
                style={{
                  animation: 'spin 1s linear infinite',
                  marginRight: '0.5rem',
                }}
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
              </svg>
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </button>

        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}} />
      </form>

      {/* Switch Footer Link */}
      <div className="text-center text-xs font-semibold text-slate-500 mt-6">
        Don't have an account?
        
        <a
          href="#signup"
          className="text-emerald-600 hover:text-emerald-700 transition-colors font-bold ml-1"
          onClick={(e) => {
            e.preventDefault();
            onNavigateToSignup();
          }}
        >
          Create Account
        </a>
      </div>
    </>
  );
}