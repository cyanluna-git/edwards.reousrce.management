import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/api/client';
import { useApiError } from '@/hooks/useApiError';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { User, Lock, Building2, Users, Briefcase, Mail, CheckCircle2, XCircle } from 'lucide-react';
import type { User as UserType } from '@/types';

export function ProfilePage() {
  const { user: authUser } = useAuth();
  const { t } = useTranslation('auth');
  const getErrorMessage = useApiError();
  const [user, setUser] = useState<UserType | null>(authUser);
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch latest user info on mount
  useEffect(() => {
    const fetchUserInfo = async () => {
      setIsLoadingUser(true);
      try {
        const response = await apiClient.get('/auth/me');
        setUser(response.data);
      } catch (error) {
        console.error('Failed to fetch user info:', error);
      } finally {
        setIsLoadingUser(false);
      }
    };
    fetchUserInfo();
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (passwordData.new_password !== passwordData.confirm_password) {
      setMessage({ type: 'error', text: t('errors.passwordMismatch') });
      return;
    }

    if (passwordData.new_password.length < 6) {
      setMessage({ type: 'error', text: t('errors.passwordTooShort') });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/change-password', {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
      });

      if (response.data.success) {
        setMessage({ type: 'success', text: t('errors.passwordChanged') });
        setPasswordData({
          current_password: '',
          new_password: '',
          confirm_password: '',
        });
        setTimeout(() => {
          setIsChangingPassword(false);
          setMessage(null);
        }, 2000);
      }
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: getErrorMessage(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingUser || !user) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p>{t('profile.loadingUser')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        {/* Profile Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-700 text-white text-2xl font-medium">
                {user.korean_name?.[0] || user.name?.[0] || 'U'}
              </div>
              <div>
                <CardTitle className="text-2xl">
                  {user.korean_name || user.name}
                </CardTitle>
                <CardDescription className="text-base mt-1">
                  {user.name !== user.korean_name && user.name}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t('profile.title')}</CardTitle>
            <CardDescription>{t('profile.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Email */}
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-slate-500 mt-0.5" />
                <div className="flex-1">
                  <Label className="text-sm text-slate-500">{t('common:form.email')}</Label>
                  <p className="text-sm font-medium">{user.email}</p>
                </div>
              </div>

              {/* Role */}
              <div className="flex items-start gap-3">
                <Briefcase className="h-5 w-5 text-slate-500 mt-0.5" />
                <div className="flex-1">
                  <Label className="text-sm text-slate-500">{t('profile.role')}</Label>
                  <p className="text-sm font-medium">{user.role}</p>
                </div>
              </div>

              {/* Department */}
              {user.department && (
                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-slate-500 mt-0.5" />
                  <div className="flex-1">
                    <Label className="text-sm text-slate-500">{t('profile.department')}</Label>
                    <p className="text-sm font-medium">{user.department.name}</p>
                  </div>
                </div>
              )}

              {/* Sub Team */}
              {user.sub_team && (
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-slate-500 mt-0.5" />
                  <div className="flex-1">
                    <Label className="text-sm text-slate-500">{t('profile.subTeam')}</Label>
                    <p className="text-sm font-medium">{user.sub_team.name}</p>
                  </div>
                </div>
              )}

              {/* Position */}
              {user.position && (
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-slate-500 mt-0.5" />
                  <div className="flex-1">
                    <Label className="text-sm text-slate-500">{t('profile.position')}</Label>
                    <p className="text-sm font-medium">
                      {user.position.name}
                    </p>
                  </div>
                </div>
              )}

              {/* Primary Business Unit */}
              {user.primary_business_unit && (
                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-slate-500 mt-0.5" />
                  <div className="flex-1">
                    <Label className="text-sm text-slate-500">{t('profile.primaryBusinessUnit')}</Label>
                    <p className="text-sm font-medium">{user.primary_business_unit.name}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Password Change */}
        <Card>
          <CardHeader>
            <CardTitle>{t('profile.changePassword')}</CardTitle>
            <CardDescription>{t('profile.changePasswordSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {message && (
              <Alert
                variant={message.type === 'error' ? 'destructive' : 'default'}
                className="mb-4"
              >
                {message.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertTitle>{message.type === 'success' ? t('common:status.success') : t('common:status.error')}</AlertTitle>
                <AlertDescription>{message.text}</AlertDescription>
              </Alert>
            )}
            {!isChangingPassword ? (
              <Button
                onClick={() => {
                  setIsChangingPassword(true);
                  setMessage(null);
                }}
                variant="outline"
                className="w-full"
              >
                <Lock className="h-4 w-4 mr-2" />
                {t('profile.changePassword')}
              </Button>
            ) : (
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current_password">{t('profile.currentPassword')}</Label>
                  <Input
                    id="current_password"
                    type="password"
                    value={passwordData.current_password}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, current_password: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new_password">{t('profile.newPassword')}</Label>
                  <Input
                    id="new_password"
                    type="password"
                    value={passwordData.new_password}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, new_password: e.target.value })
                    }
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm_password">{t('profile.confirmNewPassword')}</Label>
                  <Input
                    id="confirm_password"
                    type="password"
                    value={passwordData.confirm_password}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, confirm_password: e.target.value })
                    }
                    required
                    minLength={6}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? t('profile.changingPassword') : t('profile.changePassword')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsChangingPassword(false);
                      setPasswordData({
                        current_password: '',
                        new_password: '',
                        confirm_password: '',
                      });
                    }}
                  >
                    {t('common:buttons.cancel')}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
