import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { config } from '../config';

type ApiResponse = {
  message: string;
  path: string;
  method: string;
  invocationCount: number;
  timestamp: string;
};

export function HomePage() {
  const { idToken, signOut } = useAuth();
  const [result, setResult] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  const callApi = async () => {
    setLoading(true);
    setIsError(false);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (idToken) headers['Authorization'] = idToken;

      const res = await fetch(`${config.API_BASE_URL}/api/`, { headers });
      const data: ApiResponse = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setIsError(true);
      setResult(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-bold text-gray-900">Serverless SPA Demo</h1>
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">API Connectivity Test</h2>
              <p className="mt-1 text-sm text-gray-500">Call the Lambda backend via API Gateway</p>
            </div>
            <button
              type="button"
              onClick={callApi}
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Calling...
                </span>
              ) : (
                'Call /api/'
              )}
            </button>
          </div>

          {result !== null && (
            <pre
              className={`mt-4 overflow-x-auto rounded-lg p-4 text-sm ${
                isError ? 'bg-red-50 text-red-700' : 'bg-gray-900 text-green-400'
              }`}
            >
              {result}
            </pre>
          )}

          {result === null && (
            <div className="mt-4 rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-400">
              Click the button to test API connectivity
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
