import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { User, Lock, Building2, Users, Briefcase, Mail } from 'lucide-react';
import type { User as UserType } from '@/types';

export function ProfilePage() {
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const [user, setUser] = useState<UserType | null>(authUser);
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [isLoading, setIsLoading] = useState(false);

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

    if (passwordData.new_password !== passwordData.confirm_password) {
      toast({
        title: 'Error',
        description: 'New passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    if (passwordData.new_password.length < 6) {
      toast({
        title: 'Error',
        description: 'Password must be at least 6 characters long',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/change-password', {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
      });

      if (response.data.success) {
        toast({
          title: 'Success',
          description: 'Password changed successfully',
        });
        setPasswordData({
          current_password: '',
          new_password: '',
          confirm_password: '',
        });
        setIsChangingPassword(false);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to change password',
        variant: 'destructive',
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
            <p>Loading user information...</p>
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
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Your account details and organization information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Email */}
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-slate-500 mt-0.5" />
                <div className="flex-1">
                  <Label className="text-sm text-slate-500">Email</Label>
                  <p className="text-sm font-medium">{user.email}</p>
                </div>
              </div>

              {/* Role */}
              <div className="flex items-start gap-3">
                <Briefcase className="h-5 w-5 text-slate-500 mt-0.5" />
                <div className="flex-1">
                  <Label className="text-sm text-slate-500">Role</Label>
                  <p className="text-sm font-medium">{user.role}</p>
                </div>
              </div>

              {/* Department */}
              {user.department && (
                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-slate-500 mt-0.5" />
                  <div className="flex-1">
                    <Label className="text-sm text-slate-500">Department</Label>
                    <p className="text-sm font-medium">{user.department.name}</p>
                  </div>
                </div>
              )}

              {/* Sub Team */}
              {user.sub_team && (
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-slate-500 mt-0.5" />
                  <div className="flex-1">
                    <Label className="text-sm text-slate-500">Sub Team</Label>
                    <p className="text-sm font-medium">{user.sub_team.name}</p>
                  </div>
                </div>
              )}

              {/* Position */}
              {user.position && (
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-slate-500 mt-0.5" />
                  <div className="flex-1">
                    <Label className="text-sm text-slate-500">Position</Label>
                    <p className="text-sm font-medium">
                      {user.position.name}
                      {user.position.level && ` (Level ${user.position.level})`}
                    </p>
                  </div>
                </div>
              )}

              {/* Primary Business Unit */}
              {user.primary_business_unit && (
                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-slate-500 mt-0.5" />
                  <div className="flex-1">
                    <Label className="text-sm text-slate-500">Primary Business Unit</Label>
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
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <CardContent>
            {!isChangingPassword ? (
              <Button
                onClick={() => setIsChangingPassword(true)}
                variant="outline"
                className="w-full"
              >
                <Lock className="h-4 w-4 mr-2" />
                Change Password
              </Button>
            ) : (
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current_password">Current Password</Label>
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
                  <Label htmlFor="new_password">New Password</Label>
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
                  <Label htmlFor="confirm_password">Confirm New Password</Label>
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
                    {isLoading ? 'Changing...' : 'Change Password'}
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
                    Cancel
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
