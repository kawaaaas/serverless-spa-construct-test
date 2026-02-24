import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { confirmSignUp, signIn, signUp } from '../auth';
import { useAuth } from '../AuthContext';

type Mode = 'signin' | 'signup' | 'confirm';

const TITLES: Record<Mode, string> = {
  signin: 'Sign In',
  signup: 'Sign Up',
  confirm: 'Confirm Code',
};

export function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        await signUp(email, password);
        setMessage('Check your email for the confirmation code.');
        setMode('confirm');
      } else if (mode === 'confirm') {
        await confirmSignUp(email, code);
        setMessage('Confirmed! Signing in...');
        await signIn(email, password);
        await refresh();
        navigate('/', { replace: true });
      } else {
        await signIn(email, password);
        await refresh();
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl bg-white p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">{TITLES[mode]}</h1>
          <p className="mt-1 text-sm text-gray-500">Serverless SPA Demo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {mode !== 'confirm' && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          )}

          {mode === 'confirm' && (
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700">
                Confirmation Code
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
          >
            {loading ? 'Processing...' : TITLES[mode]}
          </button>
        </form>

        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {message && (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</div>
        )}

        <div className="text-center text-sm text-gray-500">
          {mode === 'signin' ? (
            <p>
              No account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError('');
                  setMessage('');
                }}
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Sign Up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError('');
                  setMessage('');
                }}
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Sign In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
