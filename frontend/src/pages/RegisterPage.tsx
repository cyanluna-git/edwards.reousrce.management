import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ssoRegister, getDepartments, getJobPositionsList } from '@/api/client';
import type { Department, JobPosition } from '@/api/client';
import { BarChart3, Loader2, AlertCircle, UserPlus } from 'lucide-react';

interface TokenPayload {
  email?: string;
  name?: string;
}

function decodeTokenPayload(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return { email: payload.email, name: payload.name };
  } catch {
    return null;
  }
}

export function RegisterPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { login } = useAuth();

  const [tokenPayload, setTokenPayload] = useState<TokenPayload | null>(null);
  const [name, setName] = useState('');
  const [koreanName, setKoreanName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [positionId, setPositionId] = useState('');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<JobPosition[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse token on mount
  useEffect(() => {
    if (token) {
      const payload = decodeTokenPayload(token);
      setTokenPayload(payload);
      if (payload?.name) {
        setName(payload.name);
      }
    }
  }, [token]);

  // Fetch departments and positions
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [depts, pos] = await Promise.all([
          getDepartments(),
          getJobPositionsList(),
        ]);
        setDepartments(depts.filter((d) => d.is_active));
        setPositions(pos.filter((p) => p.is_active));
      } catch {
        setError('Failed to load form data. Please try again.');
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await ssoRegister({
        registration_token: token,
        name,
        korean_name: koreanName,
        department_id: departmentId,
        position_id: positionId,
      });
      login(response.access_token, response.refresh_token);
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 401) {
        setError('Registration token has expired. Please sign in with SSO again.');
      } else if (status === 409) {
        setError('An account with this email already exists. Please sign in instead.');
      } else if (status === 400 && typeof detail === 'string') {
        setError(detail);
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // No token - show guidance
  if (!token) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden">
              <div className="pt-10 pb-6 px-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 mb-6 shadow-lg shadow-blue-500/30">
                  <BarChart3 className="w-8 h-8 text-white" strokeWidth={2.5} />
                </div>
                <h1 className="text-2xl font-bold text-slate-800 mb-4">
                  Account Registration
                </h1>
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-left">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-semibold text-amber-800 mb-1">SSO Login Required</p>
                      <p className="text-amber-700">
                        To register, please sign in with Microsoft SSO first. You will be redirected here to complete your registration.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-8 pb-8">
                <Link to="/login">
                  <Button className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-lg shadow-lg shadow-blue-500/25">
                    Go to Login
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden">
            {/* Header */}
            <div className="pt-10 pb-6 px-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 mb-6 shadow-lg shadow-blue-500/30">
                <UserPlus className="w-8 h-8 text-white" strokeWidth={2.5} />
              </div>
              <h1 className="text-2xl font-bold text-slate-800 mb-2">
                Complete Registration
              </h1>
              <p className="text-sm text-slate-500">
                Fill in the details below to create your account
              </p>
            </div>

            {/* Form */}
            <div className="px-8 pb-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email (read-only) */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={tokenPayload?.email || ''}
                    disabled
                    className="h-12 bg-slate-100 border-slate-200 text-slate-600"
                  />
                  <p className="text-xs text-slate-400">Verified via SSO - cannot be changed</p>
                </div>

                {/* Name (English) */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Name (English)
                  </label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="e.g. John Doe"
                    className="h-12 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  />
                </div>

                {/* Korean Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Korean Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={koreanName}
                    onChange={(e) => setKoreanName(e.target.value)}
                    required
                    placeholder="e.g. 홍길동"
                    className="h-12 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  />
                </div>

                {/* Department */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Department <span className="text-red-500">*</span>
                  </label>
                  {isLoadingData ? (
                    <div className="h-12 bg-slate-100 rounded-md border border-slate-200 flex items-center px-3">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      <span className="ml-2 text-sm text-slate-400">Loading...</span>
                    </div>
                  ) : (
                    <Select value={departmentId} onValueChange={setDepartmentId} required>
                      <SelectTrigger className="h-12 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name} ({dept.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Position */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Position <span className="text-red-500">*</span>
                  </label>
                  {isLoadingData ? (
                    <div className="h-12 bg-slate-100 rounded-md border border-slate-200 flex items-center px-3">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      <span className="ml-2 text-sm text-slate-400">Loading...</span>
                    </div>
                  ) : (
                    <Select value={positionId} onValueChange={setPositionId} required>
                      <SelectTrigger className="h-12 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder="Select position" />
                      </SelectTrigger>
                      <SelectContent>
                        {positions.map((pos) => (
                          <SelectItem key={pos.id} value={pos.id}>
                            {pos.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Error */}
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-sm text-red-600 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {error}
                    </p>
                  </div>
                )}

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={isSubmitting || isLoadingData || !departmentId || !positionId || !koreanName}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-lg shadow-lg shadow-blue-500/25 transition-all duration-200 disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating account...
                    </span>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  to="/login"
                  className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Already have an account? Sign in
                </Link>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-xs text-slate-500">
              &copy; {new Date().getFullYear()} Edwards Korea Engineering. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
