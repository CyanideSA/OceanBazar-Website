'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { deliveryApi } from '@/lib/api';

export type PathaoAddressForm = {
  label: string;
  line1: string;
  line2: string;
  city: string;
  district: string;
  postalCode: string;
  isDefault: boolean;
  pathaoCityId: number | null;
  pathaoZoneId: number | null;
  pathaoAreaId: number | null;
  pathaoCityName: string;
  pathaoZoneName: string;
  pathaoAreaName: string;
};

export const emptyPathaoAddressForm = (): PathaoAddressForm => ({
  label: '',
  line1: '',
  line2: '',
  city: '',
  district: '',
  postalCode: '',
  isDefault: false,
  pathaoCityId: null,
  pathaoZoneId: null,
  pathaoAreaId: null,
  pathaoCityName: '',
  pathaoZoneName: '',
  pathaoAreaName: '',
});

type GeoItem = { city_id?: number; zone_id?: number; area_id?: number; city_name?: string; zone_name?: string; area_name?: string; id?: number; name?: string };

function cityIdOf(c: GeoItem) {
  return Number(c.city_id ?? c.id) || 0;
}
function cityNameOf(c: GeoItem) {
  return String(c.city_name ?? c.name ?? '');
}
function zoneIdOf(z: GeoItem) {
  return Number(z.zone_id ?? z.id) || 0;
}
function zoneNameOf(z: GeoItem) {
  return String(z.zone_name ?? z.name ?? '');
}
function areaIdOf(a: GeoItem) {
  return Number(a.area_id ?? a.id) || 0;
}
function areaNameOf(a: GeoItem) {
  return String(a.area_name ?? a.name ?? '');
}

interface Props {
  form: PathaoAddressForm;
  onChange: (next: PathaoAddressForm) => void;
}

export default function PathaoAddressFields({ form, onChange }: Props) {
  const t = useTranslations('checkout');
  const [cities, setCities] = useState<GeoItem[]>([]);
  const [zones, setZones] = useState<GeoItem[]>([]);
  const [areas, setAreas] = useState<GeoItem[]>([]);
  const [geoError, setGeoError] = useState('');
  const [loadingCities, setLoadingCities] = useState(true);
  const [loadingZones, setLoadingZones] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingCities(true);
    deliveryApi
      .pathaoCities()
      .then((r) => {
        if (!cancelled) setCities((r.data?.cities as GeoItem[]) || []);
      })
      .catch((e: any) => {
        if (!cancelled) setGeoError(e?.response?.data?.error || 'Could not load courier cities');
      })
      .finally(() => {
        if (!cancelled) setLoadingCities(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!form.pathaoCityId) {
      setZones([]);
      setAreas([]);
      return;
    }
    let cancelled = false;
    setLoadingZones(true);
    deliveryApi
      .pathaoZones(form.pathaoCityId)
      .then((r) => {
        if (!cancelled) setZones((r.data?.zones as GeoItem[]) || []);
      })
      .catch(() => {
        if (!cancelled) setZones([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingZones(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.pathaoCityId]);

  useEffect(() => {
    if (!form.pathaoZoneId) {
      setAreas([]);
      return;
    }
    let cancelled = false;
    setLoadingAreas(true);
    deliveryApi
      .pathaoAreas(form.pathaoZoneId)
      .then((r) => {
        if (!cancelled) setAreas((r.data?.areas as GeoItem[]) || []);
      })
      .catch(() => {
        if (!cancelled) setAreas([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingAreas(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.pathaoZoneId]);

  const selectClass = 'mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm';

  return (
    <>
      {geoError ? <p className="sm:col-span-2 text-sm text-destructive">{geoError}</p> : null}
      <label>
        <span className="text-xs font-medium text-muted-foreground">{t('addrCity')} (Pathao)</span>
        <select
          className={selectClass}
          value={form.pathaoCityId ?? ''}
          disabled={loadingCities}
          onChange={(e) => {
            const id = Number(e.target.value) || 0;
            const name = cityNameOf(cities.find((c) => cityIdOf(c) === id) || {});
            onChange({
              ...form,
              pathaoCityId: id || null,
              pathaoCityName: name,
              city: name,
              pathaoZoneId: null,
              pathaoZoneName: '',
              district: '',
              pathaoAreaId: null,
              pathaoAreaName: '',
            });
          }}
          required
        >
          <option value="">{loadingCities ? 'Loading…' : 'Select city'}</option>
          {cities.map((c) => (
            <option key={cityIdOf(c)} value={cityIdOf(c)}>
              {cityNameOf(c)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="text-xs font-medium text-muted-foreground">{t('addrDistrict')} / Zone (Pathao)</span>
        <select
          className={selectClass}
          value={form.pathaoZoneId ?? ''}
          disabled={!form.pathaoCityId || loadingZones}
          onChange={(e) => {
            const id = Number(e.target.value) || 0;
            const name = zoneNameOf(zones.find((z) => zoneIdOf(z) === id) || {});
            onChange({
              ...form,
              pathaoZoneId: id || null,
              pathaoZoneName: name,
              district: name,
              pathaoAreaId: null,
              pathaoAreaName: '',
            });
          }}
          required
        >
          <option value="">{loadingZones ? 'Loading…' : 'Select zone / district'}</option>
          {zones.map((z) => (
            <option key={zoneIdOf(z)} value={zoneIdOf(z)}>
              {zoneNameOf(z)}
            </option>
          ))}
        </select>
      </label>
      <label className="sm:col-span-2">
        <span className="text-xs font-medium text-muted-foreground">Area (Pathao, optional)</span>
        <select
          className={selectClass}
          value={form.pathaoAreaId ?? ''}
          disabled={!form.pathaoZoneId || loadingAreas}
          onChange={(e) => {
            const id = Number(e.target.value) || 0;
            const name = areaNameOf(areas.find((a) => areaIdOf(a) === id) || {});
            onChange({
              ...form,
              pathaoAreaId: id || null,
              pathaoAreaName: name,
            });
          }}
        >
          <option value="">{loadingAreas ? 'Loading…' : 'Select area (optional)'}</option>
          {areas.map((a) => (
            <option key={areaIdOf(a)} value={areaIdOf(a)}>
              {areaNameOf(a)}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
