import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useApiError } from '@/hooks/useApiError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import axios from 'axios';
import { loginUser } from '@/api/client';
import { Link, useSearchParams } from 'react-router-dom';
import { BarChart3, Mail, Lock, Loader2, Info, ShieldAlert, UserX } from 'lucide-react';

interface SsoError {
  type: 'unregistered' | 'inactive';
  email: string;
}

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ssoError, setSsoError] = useState<SsoError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation('auth');
  const getErrorMessage = useApiError();

  useEffect(() => {
    const errorType = searchParams.get('error');
    const errorEmail = searchParams.get('email');

    if (errorType === 'unregistered' || errorType === 'inactive') {
      setSsoError({ type: errorType, email: errorEmail || '' });
      // Clean URL params
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const response = await loginUser(email, password);
      login(response.access_token, response.refresh_token);
      // The redirection will be handled by the App component
    } catch (err: unknown) {
      console.error(err);
      if (axios.isAxiosError(err) && err.response) {
        setError(getErrorMessage(err));
      } else {
        setError(t('errors.loginFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Login Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden">
            {/* Header with Logo */}
            <div className="pt-10 pb-6 px-8 text-center">
              {/* Logo Icon */}
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 mb-6 shadow-lg shadow-blue-500/30">
                <BarChart3 className="w-8 h-8 text-white" strokeWidth={2.5} />
              </div>

              {/* Title */}
              <h1 className="text-2xl font-bold text-slate-800 mb-2">
                {t('login.title')}
              </h1>
              <h2 className="text-xl font-semibold text-blue-600 mb-3">
                {t('login.subtitle')}
              </h2>
              <p className="text-sm text-slate-500">
                {t('login.description')}
              </p>
            </div>

            {/* SSO Error Banner */}
            {ssoError && (
              <div className="mx-8 mb-2">
                <div className={`p-4 rounded-lg border ${
                  ssoError.type === 'unregistered'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-start gap-3">
                    {ssoError.type === 'unregistered' ? (
                      <UserX className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="text-sm">
                      {ssoError.type === 'unregistered' ? (
                        <>
                          <p className="font-semibold text-amber-800 mb-1">{t('ssoErrors.accountNotRegistered')}</p>
                          <p className="text-amber-700">
                            {t('ssoErrors.notRegisteredMessage', { email: ssoError.email })}
                          </p>
                          <p className="text-amber-700 mt-2">
                            {t('ssoErrors.contactAdmin')}
                          </p>
                          <a
                            href="mailto:gerald.park@edwardsvacuum.com?subject=EOB Access Request&body=Please register my account for Edwards Operation Board.%0A%0AEmail: "
                            className="inline-block mt-2 text-amber-800 underline hover:text-amber-900 font-medium"
                          >
                            {t('ssoErrors.sendAccessRequest')}
                          </a>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold text-red-800 mb-1">{t('ssoErrors.accountInactive')}</p>
                          <p className="text-red-700">
                            {t('ssoErrors.inactiveMessage', { email: ssoError.email })}
                          </p>
                          <p className="text-red-700 mt-2">
                            {t('ssoErrors.contactReactivate')}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSsoError(null)}
                    className="mt-3 text-xs text-slate-500 hover:text-slate-700 underline"
                  >
                    {t('common:buttons.dismiss')}
                  </button>
                </div>
              </div>
            )}

            {/* Form Section */}
            <div className="px-8 pb-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email Field */}
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-slate-700">
                    {t('login.email')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-slate-400" />
                    </div>
                    <Input
                      id="email"
                      type="email"
                      placeholder={t('login.emailPlaceholder')}
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-blue-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-slate-700">
                    {t('login.password')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400" />
                    </div>
                    <Input
                      id="password"
                      type="password"
                      placeholder={t('login.passwordPlaceholder')}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 h-12 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-blue-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-sm text-red-600 flex items-center gap-2">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500"></span>
                      {error}
                    </p>
                  </div>
                )}

                {/* Login Button */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-lg shadow-lg shadow-blue-500/25 transition-all duration-200 disabled:opacity-70"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t('login.signingIn')}
                    </span>
                  ) : (
                    t('login.signIn')
                  )}
                </Button>

                {/* SSO Separator */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-200"></span>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-slate-500 font-medium tracking-wider">
                      {t('login.orContinueWith')}
                    </span>
                  </div>
                </div>

                {/* SSO Login Button */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-3"
                  onClick={() => {
                    // Use absolute URL for SSO login to avoid issues with proxies during redirection
                    const apiBase = import.meta.env.VITE_API_URL || '';

                    // Force /api prefix if not present to ensure it hits the Nginx API proxy
                    let ssoLoginUrl = '';
                    if (apiBase && apiBase !== '/') {
                      ssoLoginUrl = `${apiBase}/auth/sso/login`;
                    } else {
                      ssoLoginUrl = `/api/auth/sso/login`;
                    }

                    // Clean up double slashes
                    ssoLoginUrl = ssoLoginUrl.replace(/\/+/g, '/');

                    if (window.location.hostname === 'localhost' && !apiBase.startsWith('http')) {
                      // In local dev, redirect to the known backend port
                      window.location.href = `http://localhost:8004/api/auth/sso/login`;
                    } else {
                      // In production, use the constructed relative URL
                      window.location.href = ssoLoginUrl;
                    }
                  }}
                >
                  <svg className="w-5 h-5" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#f3f3f3" d="M0 0h23v23H0z"/>
                    <path fill="#f35325" d="M1 1h10v10H1z"/>
                    <path fill="#81bc06" d="M12 1h10v10H12z"/>
                    <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                    <path fill="#ffba08" d="M12 12h10v10H12z"/>
                  </svg>
                  {t('login.ssoButton')}
                </Button>
              </form>

            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center space-y-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Info className="w-4 h-4" />
              {t('login.portalIntro')}
            </Link>
            <p className="text-xs text-slate-500">
              {t('common:footer.copyright', { year: new Date().getFullYear() })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
