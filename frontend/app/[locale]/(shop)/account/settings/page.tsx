'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, profileApi, uploadApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import LanguageSelect from '@/components/shared/LanguageSelect';
import { useRecaptchaBadge } from '@/lib/useRecaptchaBadge';
import RecaptchaLegalNotice from '@/components/auth/RecaptchaLegalNotice';
import type { User } from '@/types';

function mapProfileUser(raw: Record<string, unknown>): Partial<User> {
  return {
    name: String(raw.name ?? ''),
    preferredLang: raw.preferredLang === 'bn' ? 'bn' : 'en',
    profileImage: raw.profileImage != null ? String(raw.profileImage) : null,
  };
}

export default function AccountSettingsPage() {
  const t = useTranslations('account');
  const ta = useTranslations('auth');
  const locale = useLocale();
  const { user, updateUser } = useAuthStore();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  useRecaptchaBadge('account-settings-password');

  const [name, setName] = useState(user?.name ?? '');
  const [photoUrl, setPhotoUrl] = useState(user?.profileImage ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setName(user?.name ?? '');
    setPhotoUrl(user?.profileImage ?? '');
  }, [user?.name, user?.profileImage]);

  const uploadPhoto = useMutation({
    mutationFn: (file: File) => uploadApi.profilePhoto(file).then((r) => String((r.data as { url?: string }).url ?? '')),
    onSuccess: (url) => {
      if (!url) return;
      setPhotoUrl(url);
      updateUser({ profileImage: url });
      setMsg(t('changesSaved'));
      setErr(null);
    },
    onError: () => {
      setErr('Photo upload failed');
      setMsg(null);
    },
  });

  const clearPhoto = useMutation({
    mutationFn: () => profileApi.update({ profileImage: null }),
    onSuccess: () => {
      setPhotoUrl('');
      updateUser({ profileImage: null });
      setMsg(t('changesSaved'));
      setErr(null);
    },
  });

  const saveProfile = useMutation({
    mutationFn: () => profileApi.update({ name: name.trim(), preferredLang: locale as 'en' | 'bn' }),
    onSuccess: (res) => {
      const raw = (res.data as { user: Record<string, unknown> }).user;
      if (raw) updateUser(mapProfileUser(raw));
      setMsg(t('changesSaved'));
      setErr(null);
      queryClient.invalidateQueries({ queryKey: ['ob-points-balance'] });
    },
    onError: (e: unknown) => {
      const m = e && typeof e === 'object' && 'response' in e ? (e as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
      setErr(m ?? 'Error');
      setMsg(null);
    },
  });

  const changePassword = useMutation({
    mutationFn: () => authApi.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMsg(t('passwordChanged'));
      setErr(null);
    },
    onError: (e: unknown) => {
      const m = e && typeof e === 'object' && 'response' in e ? (e as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
      setErr(m ?? 'Error');
      setMsg(null);
    },
  });

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('settings')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('settingsIntro')}</p>
      </div>

      {msg ? <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{msg}</p> : null}
      {err ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p> : null}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{t('editProfile')}</h2>

        <div className="flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-full border border-border bg-muted flex items-center justify-center text-lg font-bold text-primary">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              (name || user?.name || '?').charAt(0).toUpperCase()
            )}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{t('profilePhotoHint')}</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadPhoto.mutate(f);
                e.target.value = '';
              }}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={uploadPhoto.isPending}
                onClick={() => fileRef.current?.click()}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                {uploadPhoto.isPending ? t('saving') : photoUrl ? t('profilePhotoChange') : t('profilePhotoUpload')}
              </button>
              {photoUrl ? (
                <button
                  type="button"
                  disabled={clearPhoto.isPending}
                  onClick={() => clearPhoto.mutate()}
                  className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground"
                >
                  {t('removePhoto')}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <label className="block text-xs font-medium text-muted-foreground">{t('name')}</label>
        <input
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div>
          <span className="text-xs font-medium text-muted-foreground">{t('preferredLanguage')}</span>
          <div className="mt-2">
            <LanguageSelect />
          </div>
        </div>
        <button
          type="button"
          disabled={saveProfile.isPending || !name.trim()}
          onClick={() => saveProfile.mutate()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saveProfile.isPending ? t('saving') : t('saveSettings')}
        </button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{ta('changePassword')}</h2>
        <label className="block text-xs font-medium text-muted-foreground">{ta('currentPassword')}</label>
        <input
          type="password"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
        />
        <label className="block text-xs font-medium text-muted-foreground">{ta('newPassword')}</label>
        <input
          type="password"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
        />
        <label className="block text-xs font-medium text-muted-foreground">{ta('confirmPassword')}</label>
        <input
          type="password"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
        />
        <p className="text-xs text-muted-foreground">{ta('passwordRules')}</p>
        <button
          type="button"
          disabled={
            changePassword.isPending ||
            !currentPassword ||
            !newPassword ||
            newPassword !== confirmPassword
          }
          onClick={() => changePassword.mutate()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {ta('changePassword')}
        </button>
        <RecaptchaLegalNotice />
      </section>
    </div>
  );
}
