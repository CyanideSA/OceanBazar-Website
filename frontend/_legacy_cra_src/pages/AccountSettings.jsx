import React, { useEffect, useState, useRef } from 'react';
import AccountLayout from '../components/AccountLayout';
import { Bell, Lock, User, Mail, Pencil, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { profileAPI, authAPI } from '../api/service';
import { useToast } from '../hooks/use-toast';
import { syncStorefrontUser } from '@/utils/storefrontUserSync';

const AccountSettings = () => {
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    userType: 'retail',
    address: '',
    dateOfBirth: '',
    preferredPaymentMethod: '',
    businessName: '',
    businessType: '',
    profileImageUrl: ''
  });
  const [uploading, setUploading] = useState(false);
  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    push: true
  });

  const refreshProfile = async () => {
    try {
      const res = await profileAPI.get();
      setProfile((p) => ({ ...p, ...res.data }));
      syncStorefrontUser(res.data);
    } catch (_) {}
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  const savePartial = async (patch) => {
    try {
      const res = await profileAPI.update({ ...profile, ...patch });
      setProfile((p) => ({ ...p, ...res.data }));
      syncStorefrontUser(res.data);
      toast({ title: 'Saved', description: 'Your profile was updated.' });
    } catch (e) {
      toast({
        title: 'Error',
        description: e.response?.data?.detail || 'Could not save',
        variant: 'destructive'
      });
    }
  };

  const promptEdit = (field, label, currentValue) => {
    const next = window.prompt(`${label}:`, currentValue || '');
    if (next === null) return;
    savePartial({ [field]: next });
  };

  const onPhotoSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await profileAPI.uploadPhoto(fd);
      setProfile((p) => ({ ...p, ...res.data }));
      syncStorefrontUser(res.data);
      toast({ title: 'Photo updated' });
    } catch (err) {
      toast({ title: 'Upload failed', description: err.response?.data?.detail || 'Try another image', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const changePassword = async () => {
    const current = window.prompt('Current password:');
    if (current === null) return;
    const next = window.prompt('New password (min 6 characters):');
    if (next === null) return;
    const confirm = window.prompt('Confirm new password:');
    if (confirm === null) return;
    if (next !== confirm) {
      toast({ title: 'Mismatch', description: 'New passwords do not match.', variant: 'destructive' });
      return;
    }
    try {
      await authAPI.changePassword({ currentPassword: current, newPassword: next });
      toast({ title: 'Password updated', description: 'Sign in again on other devices if needed.' });
    } catch (e) {
      toast({
        title: 'Could not update',
        description: e.response?.data?.detail || 'Check your current password',
        variant: 'destructive'
      });
    }
  };

  return (
    <AccountLayout>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">Settings</h1>

        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Personal Information
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Use <strong>Edit</strong> to change a field (opens a quick prompt). Upload a profile photo below.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 items-start mb-6">
              <div className="flex flex-col items-center gap-2">
                {profile.profileImageUrl ? (
                  <img src={profile.profileImageUrl} alt="" className="w-24 h-24 rounded-full object-cover border border-gray-100" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[#5BA3D0]">
                    <User className="w-12 h-12" />
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoSelected} />
                <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? 'Uploading…' : 'Upload photo'}
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              {[
                ['name', 'Full name', profile.name],
                ['email', 'Email', profile.email],
                ['phone', 'Phone', profile.phone],
                ['address', 'Address', profile.address],
                ['dateOfBirth', 'Date of birth (YYYY-MM-DD)', profile.dateOfBirth]
              ].map(([key, label, val]) => (
                <div
                  key={key}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2 border-b border-gray-100 dark:border-gray-700"
                >
                  <div>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-gray-800 dark:text-gray-100">{val || '—'}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => promptEdit(key, label, val)}
                  >
                    <Pencil className="w-3 h-3 mr-1" /> Edit
                  </Button>
                </div>
              ))}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2">
                <div>
                  <p className="text-xs text-gray-500">Customer type</p>
                  <p className="text-gray-800 dark:text-gray-100">{profile.userType === 'wholesale' ? 'Wholesale' : 'Retail'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Payment & Business Details
            </h2>
            <div className="mb-6 p-4 rounded-xl bg-[#F5F9FC] dark:bg-gray-900/40 border border-[#E4F0F9] dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <CreditCard className="w-5 h-5 text-[#5BA3D0] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">Saved payment methods</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    Add cards, bKash, Nagad, or bank hints (last 4 digits only — never full numbers on our servers).
                  </p>
                </div>
              </div>
              <Button asChild variant="default" className="bg-[#5BA3D0] hover:bg-[#4A90B8] shrink-0">
                <Link to="/account/payments">Manage payment methods</Link>
              </Button>
            </div>
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2 border-b border-gray-100 dark:border-gray-700">
                <div>
                  <p className="text-xs text-gray-500">Preferred payment method</p>
                  <p className="text-gray-800 dark:text-gray-100">{profile.preferredPaymentMethod || '—'}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => promptEdit('preferredPaymentMethod', 'Preferred payment method', profile.preferredPaymentMethod)}>
                  <Pencil className="w-3 h-3 mr-1" /> Edit
                </Button>
              </div>
              {profile.userType === 'wholesale' && (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2 border-b border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="text-xs text-gray-500">Business name</p>
                      <p className="text-gray-800 dark:text-gray-100">{profile.businessName || '—'}</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => promptEdit('businessName', 'Business name', profile.businessName)}>
                      <Pencil className="w-3 h-3 mr-1" /> Edit
                    </Button>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2">
                    <div>
                      <p className="text-xs text-gray-500">Business type</p>
                      <p className="text-gray-800 dark:text-gray-100">{profile.businessType || '—'}</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => promptEdit('businessType', 'Business type', profile.businessType)}>
                      <Pencil className="w-3 h-3 mr-1" /> Edit
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notification Preferences
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800 dark:text-white">Email Notifications</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Receive order updates via email</p>
                </div>
                <Switch checked={notifications.email} onCheckedChange={(checked) => setNotifications({...notifications, email: checked})} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800 dark:text-white">SMS Notifications</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Receive order updates via SMS</p>
                </div>
                <Switch checked={notifications.sms} onCheckedChange={(checked) => setNotifications({...notifications, sms: checked})} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800 dark:text-white">Push Notifications</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Receive browser notifications</p>
                </div>
                <Switch checked={notifications.push} onCheckedChange={(checked) => setNotifications({...notifications, push: checked})} />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Change Password
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">You will be asked for your current password and new password in secure prompts.</p>
            <Button type="button" className="bg-[#5BA3D0] hover:bg-[#4A90B8] text-white" onClick={changePassword}>
              Update password
            </Button>
          </div>
        </div>
      </div>
    </AccountLayout>
  );
};

export default AccountSettings;
