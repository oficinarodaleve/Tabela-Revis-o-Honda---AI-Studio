import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { CustomIntegration, IntegrationsData, TrackingPixelsAdminConfig } from '../../types';
import { adminFetch } from '../../utils/adminAuth';
import { saveGestorDraftCache } from '../../utils/gestorBackup';
import {
  extractGoogleSiteVerificationCode,
  sanitizeGoogleConversionLabel,
  sanitizeGoogleTagId,
  sanitizeGtmId,
  sanitizePixelId,
  sanitizeTikTokPixelId,
} from '../../utils/metaPixel';
import { formatDateTimeBR } from '../../utils/pricing';

const DEFAULT_TRACKING_PIXELS: TrackingPixelsAdminConfig = {
  gtm: { enabled: false, container_id: '' },
  ga4: { enabled: false, measurement_id: '' },
  google_ads: { enabled: false, ads_id: '', conversion_label: '' },
  meta_pixel: {
    enabled: false,
    pixel_id: '',
    has_capi_token: false,
    capi_token_masked: '',
    domain_verification: '',
  },
  tiktok_pixel: {
    enabled: false,
    pixel_id: '',
    has_events_token: false,
    events_token_masked: '',
  },
  google_search_console: {
    verification_code: '',
  },
};

function validateTrackingPixelsForm(
  cfg: TrackingPixelsAdminConfig,
  rawGscInput?: string
): string | null {
  const gtmId = cfg.gtm.container_id.trim().toUpperCase();
  const ga4Id = cfg.ga4.measurement_id.trim().toUpperCase();
  const adsId = cfg.google_ads.ads_id.trim().toUpperCase();
  const metaId = cfg.meta_pixel.pixel_id.trim();
  const ttId = cfg.tiktok_pixel.pixel_id.trim().toUpperCase();

  if (gtmId && !/^GTM-[A-Z0-9]{4,16}$/.test(gtmId)) {
    return 'ID do Contêiner GTM inválido. Use o formato GTM-XXXXXXX.';
  }
  if (ga4Id && !/^G-[A-Z0-9]{4,20}$/.test(ga4Id)) {
    return 'ID da Métrica GA4 inválido. Use o formato G-XXXXXXXXXX.';
  }
  if (adsId && !/^AW-[A-Z0-9]{5,20}$/.test(adsId)) {
    return 'ID da Tag do Google Ads inválido. Use o formato AW-123456789.';
  }
  if (metaId && !/^\d{5,25}$/.test(metaId)) {
    return 'ID do Pixel da Meta inválido. Informe apenas dígitos numéricos.';
  }
  if (ttId && !/^[A-Z0-9_-]{6,32}$/.test(ttId)) {
    return 'ID do Pixel do TikTok inválido. Informe letras e números (mínimo 6 caracteres).';
  }
  if ((rawGscInput || '').trim() && !extractGoogleSiteVerificationCode(rawGscInput)) {
    return 'Código ou tag do Google Search Console inválido. Cole a tag completa com content="..." ou apenas o código de verificação.';
  }
  return null;
}

interface TabIntegrationsProps {
  integrations: IntegrationsData;
  onSaved: () => Promise<void>;
  onToast: (type: 'success' | 'error', msg: string) => void;
  autoSaveEnabled?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onAutoSaveStart?: () => void;
  onAutoSaveComplete?: () => void;
  onAutoSaveError?: (msg?: string) => void;
}

export function TabIntegrations({
  integrations,
  onSaved,
  onToast,
  autoSaveEnabled = true,
  onDirtyChange,
  onAutoSaveStart,
  onAutoSaveComplete,
  onAutoSaveError,
}: TabIntegrationsProps) {
  const [mapsActive, setMapsActive] = useState(integrations.google_maps.active);
  const [mapsKey, setMapsKey] = useState(integrations.google_maps.custom_api_key);
  const [showMapsKey, setShowMapsKey] = useState(false);

  const [mwAuto, setMwAuto] = useState(integrations.microwork.auto_sync_enabled);
  const [mwMode, setMwMode] = useState<'manual' | 'auto_api'>(
    integrations.microwork.update_mode
  );
  const [mwEndpoint, setMwEndpoint] = useState(integrations.microwork.endpoint_url);
  const [mwNewToken, setMwNewToken] = useState('');
  const [mwFreq, setMwFreq] = useState<'daily' | 'weekly'>(
    integrations.microwork.frequency
  );

  const [customItems, setCustomItems] = useState<CustomIntegration[]>(
    integrations.custom_integrations || []
  );

  const [newIntName, setNewIntName] = useState('');
  const [newIntValue, setNewIntValue] = useState('');

  const incomingTp = integrations.tracking_pixels || DEFAULT_TRACKING_PIXELS;
  const [tpGtmEnabled, setTpGtmEnabled] = useState(incomingTp.gtm.enabled);
  const [tpGtmId, setTpGtmId] = useState(incomingTp.gtm.container_id);

  const [tpGa4Enabled, setTpGa4Enabled] = useState(incomingTp.ga4.enabled);
  const [tpGa4Id, setTpGa4Id] = useState(incomingTp.ga4.measurement_id);

  const [tpAdsEnabled, setTpAdsEnabled] = useState(incomingTp.google_ads.enabled);
  const [tpAdsId, setTpAdsId] = useState(incomingTp.google_ads.ads_id);
  const [tpAdsLabel, setTpAdsLabel] = useState(incomingTp.google_ads.conversion_label);

  const [tpMetaEnabled, setTpMetaEnabled] = useState(incomingTp.meta_pixel.enabled);
  const [tpMetaId, setTpMetaId] = useState(incomingTp.meta_pixel.pixel_id);
  const [tpMetaDomain, setTpMetaDomain] = useState(incomingTp.meta_pixel.domain_verification);
  const [tpMetaNewCapi, setTpMetaNewCapi] = useState('');
  const [tpMetaClearCapi, setTpMetaClearCapi] = useState(false);
  const [showMetaCapi, setShowMetaCapi] = useState(false);

  const [tpTtEnabled, setTpTtEnabled] = useState(incomingTp.tiktok_pixel.enabled);
  const [tpTtId, setTpTtId] = useState(incomingTp.tiktok_pixel.pixel_id);
  const [tpTtNewToken, setTpTtNewToken] = useState('');
  const [tpTtClearToken, setTpTtClearToken] = useState(false);
  const [showTtToken, setShowTtToken] = useState(false);

  const [tpGscVerification, setTpGscVerification] = useState(
    incomingTp.google_search_console?.verification_code || ''
  );

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ ok: boolean; msg: string } | null>(
    null
  );

  useEffect(() => {
    setMapsActive(integrations.google_maps.active);
    setMapsKey(integrations.google_maps.custom_api_key);
    setMwAuto(integrations.microwork.auto_sync_enabled);
    setMwMode(integrations.microwork.update_mode);
    setMwEndpoint(integrations.microwork.endpoint_url);
    setMwFreq(integrations.microwork.frequency);
    setCustomItems(integrations.custom_integrations || []);

    const tp = integrations.tracking_pixels || DEFAULT_TRACKING_PIXELS;
    setTpGtmEnabled(tp.gtm.enabled);
    setTpGtmId(tp.gtm.container_id);
    setTpGa4Enabled(tp.ga4.enabled);
    setTpGa4Id(tp.ga4.measurement_id);
    setTpAdsEnabled(tp.google_ads.enabled);
    setTpAdsId(tp.google_ads.ads_id);
    setTpAdsLabel(tp.google_ads.conversion_label);
    setTpMetaEnabled(tp.meta_pixel.enabled);
    setTpMetaId(tp.meta_pixel.pixel_id);
    setTpMetaDomain(tp.meta_pixel.domain_verification);
    setTpTtEnabled(tp.tiktok_pixel.enabled);
    setTpTtId(tp.tiktok_pixel.pixel_id);
    setTpGscVerification(tp.google_search_console?.verification_code || '');
  }, [integrations]);

  const extractedGscCode = useMemo(
    () => extractGoogleSiteVerificationCode(tpGscVerification),
    [tpGscVerification]
  );

  const currentTrackingState: TrackingPixelsAdminConfig = useMemo(
    () => ({
      gtm: { enabled: tpGtmEnabled, container_id: tpGtmId.trim().toUpperCase() },
      ga4: { enabled: tpGa4Enabled, measurement_id: tpGa4Id.trim().toUpperCase() },
      google_ads: {
        enabled: tpAdsEnabled,
        ads_id: tpAdsId.trim().toUpperCase(),
        conversion_label: tpAdsLabel.trim(),
      },
      meta_pixel: {
        enabled: tpMetaEnabled,
        pixel_id: sanitizePixelId(tpMetaId),
        has_capi_token: incomingTp.meta_pixel.has_capi_token,
        capi_token_masked: incomingTp.meta_pixel.capi_token_masked,
        domain_verification: tpMetaDomain.trim(),
      },
      tiktok_pixel: {
        enabled: tpTtEnabled,
        pixel_id: tpTtId.trim().toUpperCase(),
        has_events_token: incomingTp.tiktok_pixel.has_events_token,
        events_token_masked: incomingTp.tiktok_pixel.events_token_masked,
      },
      google_search_console: {
        verification_code: extractedGscCode,
      },
    }),
    [
      tpGtmEnabled,
      tpGtmId,
      tpGa4Enabled,
      tpGa4Id,
      tpAdsEnabled,
      tpAdsId,
      tpAdsLabel,
      tpMetaEnabled,
      tpMetaId,
      tpMetaDomain,
      tpTtEnabled,
      tpTtId,
      extractedGscCode,
      incomingTp,
    ]
  );

  const trackingValidationError = useMemo(
    () => validateTrackingPixelsForm(currentTrackingState, tpGscVerification),
    [currentTrackingState, tpGscVerification]
  );

  const isDirty = useMemo(() => {
    const baseTp = integrations.tracking_pixels || DEFAULT_TRACKING_PIXELS;
    return (
      mapsActive !== integrations.google_maps.active ||
      mapsKey.trim() !== (integrations.google_maps.custom_api_key || '').trim() ||
      mwAuto !== integrations.microwork.auto_sync_enabled ||
      mwMode !== integrations.microwork.update_mode ||
      mwEndpoint.trim() !== (integrations.microwork.endpoint_url || '').trim() ||
      mwFreq !== integrations.microwork.frequency ||
      mwNewToken.trim().length > 0 ||
      JSON.stringify(customItems) !== JSON.stringify(integrations.custom_integrations || []) ||
      tpGtmEnabled !== baseTp.gtm.enabled ||
      tpGtmId.trim().toUpperCase() !== baseTp.gtm.container_id ||
      tpGa4Enabled !== baseTp.ga4.enabled ||
      tpGa4Id.trim().toUpperCase() !== baseTp.ga4.measurement_id ||
      tpAdsEnabled !== baseTp.google_ads.enabled ||
      tpAdsId.trim().toUpperCase() !== baseTp.google_ads.ads_id ||
      tpAdsLabel.trim() !== baseTp.google_ads.conversion_label ||
      tpMetaEnabled !== baseTp.meta_pixel.enabled ||
      sanitizePixelId(tpMetaId) !== baseTp.meta_pixel.pixel_id ||
      tpMetaDomain.trim() !== baseTp.meta_pixel.domain_verification ||
      tpMetaNewCapi.trim().length > 0 ||
      tpMetaClearCapi ||
      tpTtEnabled !== baseTp.tiktok_pixel.enabled ||
      tpTtId.trim().toUpperCase() !== baseTp.tiktok_pixel.pixel_id ||
      tpTtNewToken.trim().length > 0 ||
      tpTtClearToken ||
      tpGscVerification.trim() !== (baseTp.google_search_console?.verification_code || '')
    );
  }, [
    mapsActive,
    mapsKey,
    mwAuto,
    mwMode,
    mwEndpoint,
    mwFreq,
    mwNewToken,
    customItems,
    integrations,
    tpGtmEnabled,
    tpGtmId,
    tpGa4Enabled,
    tpGa4Id,
    tpAdsEnabled,
    tpAdsId,
    tpAdsLabel,
    tpMetaEnabled,
    tpMetaId,
    tpMetaDomain,
    tpMetaNewCapi,
    tpMetaClearCapi,
    tpTtEnabled,
    tpTtId,
    tpTtNewToken,
    tpTtClearToken,
    tpGscVerification,
  ]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const buildPayload = () => ({
    google_maps: {
      active: mapsActive,
      custom_api_key: mapsKey.trim(),
    },
    microwork: {
      auto_sync_enabled: mwAuto,
      update_mode: mwMode,
      endpoint_url: mwEndpoint.trim(),
      new_token: mwNewToken.trim() || undefined,
      frequency: mwFreq,
    },
    custom_integrations: customItems,
    tracking_pixels: {
      gtm: currentTrackingState.gtm,
      ga4: currentTrackingState.ga4,
      google_ads: currentTrackingState.google_ads,
      meta_pixel: {
        enabled: currentTrackingState.meta_pixel.enabled,
        pixel_id: currentTrackingState.meta_pixel.pixel_id,
        domain_verification: currentTrackingState.meta_pixel.domain_verification,
        new_capi_token: tpMetaNewCapi.trim() || undefined,
        clear_capi_token: tpMetaClearCapi || undefined,
      },
      tiktok_pixel: {
        enabled: currentTrackingState.tiktok_pixel.enabled,
        pixel_id: currentTrackingState.tiktok_pixel.pixel_id,
        new_events_token: tpTtNewToken.trim() || undefined,
        clear_events_token: tpTtClearToken || undefined,
      },
      google_search_console: {
        verification_code: extractedGscCode,
      },
    },
  });

  useEffect(() => {
    if (!autoSaveEnabled || !isDirty || saving || trackingValidationError) return;
    const timer = setTimeout(async () => {
      onAutoSaveStart?.();
      const payload = buildPayload();
      saveGestorDraftCache('integracoes', payload);
      try {
        const res = await adminFetch('/api/admin/integrations', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Erro ao salvar integrações.');
        if (mwNewToken.trim()) setMwNewToken('');
        if (tpMetaNewCapi.trim() || tpMetaClearCapi) {
          setTpMetaNewCapi('');
          setTpMetaClearCapi(false);
        }
        if (tpTtNewToken.trim() || tpTtClearToken) {
          setTpTtNewToken('');
          setTpTtClearToken(false);
        }
        await onSaved();
        onAutoSaveComplete?.();
      } catch {
        onAutoSaveError?.('Erro ao salvar — tente novamente');
      }
    }, 850);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    autoSaveEnabled,
    isDirty,
    saving,
    trackingValidationError,
    mapsActive,
    mapsKey,
    mwAuto,
    mwMode,
    mwEndpoint,
    mwNewToken,
    mwFreq,
    customItems,
    currentTrackingState,
    tpMetaNewCapi,
    tpMetaClearCapi,
    tpTtNewToken,
    tpTtClearToken,
  ]);

  const handleSave = async () => {
    if (trackingValidationError) {
      onToast('error', trackingValidationError);
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      const res = await adminFetch('/api/admin/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Erro ao salvar integrações.');
      saveGestorDraftCache('integracoes', payload);
      setMwNewToken('');
      setTpMetaNewCapi('');
      setTpMetaClearCapi(false);
      setTpTtNewToken('');
      setTpTtClearToken(false);
      await onSaved();
      onToast('success', 'Configurações de integrações, APIs e pixels salvas.');
    } catch (e) {
      onToast('error', e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestFeedback(null);
    try {
      const res = await adminFetch('/api/admin/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint_url: mwEndpoint.trim(),
          new_token: mwNewToken.trim() || undefined,
        }),
      });
      const data = await res.json();
      setTestFeedback({ ok: Boolean(data.ok), msg: data.message });
    } catch {
      setTestFeedback({ ok: false, msg: 'Erro ao testar conexão.' });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await adminFetch('/api/admin/prices/sync', { method: 'POST' });
      const data = await res.json();
      await onSaved();
      onToast(
        data.result?.success === false ? 'error' : 'success',
        data.result?.message || 'Sincronização executada.'
      );
    } catch {
      onToast('error', 'Erro ao executar sincronização.');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddCustom = () => {
    if (!newIntName.trim() || !newIntValue.trim()) {
      onToast('error', 'Informe o nome e a chave/URL da integração.');
      return;
    }
    setCustomItems((prev) => [
      ...prev,
      {
        id: `${Date.now()}`,
        name: newIntName.trim(),
        value: newIntValue.trim(),
        active: true,
      },
    ]);
    setNewIntName('');
    setNewIntValue('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Integrações & APIs
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Configure Google Maps, sincronização automática com o ERP MicroWork e webhooks externos.
          </p>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className={`inline-flex items-center gap-2 self-start rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-60 ${
            !autoSaveEnabled && isDirty ? 'ring-2 ring-brand/40 ring-offset-2' : ''
          }`}
        >
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>

      {/* Card 1: Google Maps */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink">
              Integração Google Maps
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Desativada, o site mostra um link direto para o Google Maps.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMapsActive(!mapsActive)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
              mapsActive
                ? 'bg-brand text-on-brand'
                : 'bg-surface-neutral text-ink-muted'
            }`}
          >
            {mapsActive ? 'Ativo' : 'Inativo'}
          </button>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-semibold text-ink">
            Chave da API Google Maps (opcional — sobrescreve a chave do ambiente)
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type={showMapsKey ? 'text' : 'password'}
              value={mapsKey}
              onChange={(e) => setMapsKey(e.target.value)}
              placeholder="Usando chave provisionada do projeto (ou cole AIza...)"
              className="flex-1 rounded-xl border border-border bg-card px-3.5 py-2 font-mono text-xs text-ink focus:border-brand focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowMapsKey(!showMapsKey)}
              aria-label="Mostrar ou ocultar chave"
              className="rounded-xl border border-border bg-card p-2 text-ink-muted hover:bg-surface-neutral hover:text-ink"
            >
              {showMapsKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setMapsKey('')}
              aria-label="Limpar chave"
              className="rounded-xl border border-border bg-card p-2 text-ink-muted hover:bg-brand-soft hover:text-brand-text"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-[11px] text-ink-muted">
            Restrinja a chave por domínio no Google Cloud. Ela fica visível no código do site, como toda chave de mapa.
          </p>
        </div>
      </div>

      {/* Card 2: Preços e estoque (ERP MicroWork) */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink">
              Preços e estoque (ERP da oficina — MicroWork)
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Atualiza os preços das peças automaticamente a partir do seu ERP sem expor o token no front-end.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMwAuto(!mwAuto)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
              mwAuto ? 'bg-brand text-on-brand' : 'bg-surface-neutral text-ink-muted'
            }`}
          >
            {mwAuto ? 'Ligada' : 'Desligada'}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-ink">
              Modo de atualização
            </label>
            <select
              value={mwMode}
              onChange={(e) => setMwMode(e.target.value as 'manual' | 'auto_api')}
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-medium text-ink focus:border-brand focus:outline-none"
            >
              <option value="auto_api">Automático via API (MicroWork)</option>
              <option value="manual">Manual</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink">
              Frequência de atualização
            </label>
            <select
              value={mwFreq}
              onChange={(e) => setMwFreq(e.target.value as 'daily' | 'weekly')}
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-medium text-ink focus:border-brand focus:outline-none"
            >
              <option value="weekly">Semanalmente (padrão)</option>
              <option value="daily">Diariamente</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-ink">
              URL do endpoint / webhook MicroWork
            </label>
            <input
              type="url"
              value={mwEndpoint}
              onChange={(e) => setMwEndpoint(e.target.value)}
              placeholder="https://api.microwork.com.br/v1/pecas/precos"
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2 font-mono text-xs text-ink focus:border-brand focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-ink">
              Token / chave de autenticação (Bearer — armazenado apenas no servidor)
            </label>
            <input
              type="password"
              value={mwNewToken}
              onChange={(e) => setMwNewToken(e.target.value)}
              placeholder={
                integrations.microwork.has_token
                  ? `Token salvo (${integrations.microwork.token_masked}) — digite apenas para substituir`
                  : 'Cole aqui o Bearer token secreto do MicroWork'
              }
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2 font-mono text-xs text-ink focus:border-brand focus:outline-none"
            />
          </div>
        </div>

        {/* Regra de mapeamento */}
        <div className="mt-4 rounded-xl border border-border bg-surface-neutral p-3.5 text-xs text-ink-muted">
          <p className="font-bold text-ink">Regra de mapeamento:</p>
          <p className="mt-0.5">
            O preço é vinculado pelo código Honda da peça. Peças configuradas em modo Manual nunca são sobrescritas, e se a consulta falhar ou retornar zero/vazio, o último preço salvo é preservado.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={testing}
            onClick={handleTestConnection}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-ink hover:bg-surface-neutral disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4 text-ink-muted" />
            {testing ? 'Testando...' : 'Testar Conexão'}
          </button>

          <button
            type="button"
            disabled={syncing}
            onClick={handleSyncNow}
            className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-xs font-bold text-on-ink transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar Preços Agora'}
          </button>
        </div>

        {testFeedback && (
          <div
            className={`mt-3 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
              testFeedback.ok
                ? 'border-border bg-surface-neutral text-ink'
                : 'border-brand/30 bg-brand-soft text-brand-text'
            }`}
          >
            {testFeedback.msg}
          </div>
        )}

        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-border bg-surface p-3.5 text-xs">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
          <div>
            <p className="font-bold text-ink">
              Última sincronização: {formatDateTimeBR(integrations.microwork.last_sync_at)}
            </p>
            <p className="mt-0.5 text-ink-muted">
              {integrations.microwork.last_sync_result}
            </p>
          </div>
        </div>
      </div>

      {/* Card 3: Outras chaves e webhooks */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-bold text-ink">
          Outras chaves e webhooks
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          Google Analytics (GA4), Pixel da Meta, webhook de leads ou Firebase.
        </p>

        <div className="mt-4 space-y-2.5">
          {customItems.length === 0 ? (
            <p className="text-xs text-ink-muted">
              Nenhuma integração adicional cadastrada.
            </p>
          ) : (
            customItems.map((item, idx) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <div className="flex flex-1 flex-wrap items-center gap-2.5">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) =>
                      setCustomItems((prev) =>
                        prev.map((it, i) => (i === idx ? { ...it, name: e.target.value } : it))
                      )
                    }
                    className="w-44 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-bold text-ink focus:border-brand focus:outline-none"
                  />
                  <input
                    type="text"
                    value={item.value}
                    onChange={(e) =>
                      setCustomItems((prev) =>
                        prev.map((it, i) => (i === idx ? { ...it, value: e.target.value } : it))
                      )
                    }
                    className="min-w-[200px] flex-1 rounded-lg border border-border bg-card px-2.5 py-1.5 font-mono text-xs text-ink focus:border-brand focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setCustomItems((prev) =>
                        prev.map((it, i) =>
                          i === idx ? { ...it, active: !it.active } : it
                        )
                      )
                    }
                    className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                      item.active
                        ? 'bg-brand text-on-brand'
                        : 'bg-surface-neutral text-ink-muted'
                    }`}
                  >
                    {item.active ? 'Ativo' : 'Inativo'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCustomItems((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="rounded-lg p-1.5 text-ink-muted hover:bg-brand-soft hover:text-brand-text"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-border/70 pt-4">
          <input
            type="text"
            value={newIntName}
            onChange={(e) => setNewIntName(e.target.value)}
            placeholder="Nome (ex.: Google Analytics GA4)"
            className="w-56 rounded-xl border border-border bg-card px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
          />
          <input
            type="text"
            value={newIntValue}
            onChange={(e) => setNewIntValue(e.target.value)}
            placeholder="ID, chave ou URL do webhook..."
            className="min-w-[220px] flex-1 rounded-xl border border-border bg-card px-3 py-2 font-mono text-xs text-ink focus:border-brand focus:outline-none"
          />
          <button
            type="button"
            onClick={handleAddCustom}
            className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-xs font-bold text-on-ink transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova Chave / Integração
          </button>
        </div>
      </div>

      {/* Card 4: Pixels, Tags & Rastreamento */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink">
                Pixels, Tags & Rastreamento
              </h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                Configure tags de análise e pixels de conversão para campanhas de anúncios sem precisar editar o código do site.
              </p>
            </div>
          </div>
        </div>

        {/* Aviso de segurança / privacidade */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-border bg-surface-neutral p-3.5 text-xs text-ink-muted">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
          <p>
            Tokens secretos de API (server-side) são armazenados apenas no servidor e nunca expostos no front-end. Quando uma tag estiver desativada ou sem ID preenchido, nenhum script dela é carregado no site.
          </p>
        </div>

        {trackingValidationError && (
          <div className="mt-3 rounded-xl border border-brand/30 bg-brand-soft px-3.5 py-2.5 text-xs font-semibold text-brand-text">
            {trackingValidationError}
          </div>
        )}

        <div className="mt-5 space-y-4">
          {/* 1. Google Tag Manager (GTM) */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-ink">
                  Google Tag Manager (GTM)
                </h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Injeta o snippet padrão do GTM no <code className="font-mono">&lt;head&gt;</code> e <code className="font-mono">&lt;noscript&gt;</code> logo após a abertura do <code className="font-mono">&lt;body&gt;</code> apenas quando ativo.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={tpGtmEnabled}
                onClick={() => setTpGtmEnabled(!tpGtmEnabled)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                  tpGtmEnabled
                    ? 'bg-brand text-on-brand'
                    : 'bg-surface-neutral text-ink-muted'
                }`}
              >
                {tpGtmEnabled ? 'Ativo' : 'Desativado'}
              </button>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-semibold text-ink">
                ID do Contêiner GTM
              </label>
              <input
                type="text"
                value={tpGtmId}
                onChange={(e) => setTpGtmId(sanitizeGtmId(e.target.value))}
                placeholder="GTM-XXXXXXX"
                className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2 font-mono text-xs text-ink focus:border-brand focus:outline-none sm:max-w-sm"
              />
            </div>
          </div>

          {/* 2. Google Analytics 4 (GA4) */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-ink">
                  Google Analytics 4 (GA4)
                </h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Carrega o <code className="font-mono">gtag.js</code> e dispara <code className="font-mono">page_view</code> automaticamente na navegação entre rotas públicas.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={tpGa4Enabled}
                onClick={() => setTpGa4Enabled(!tpGa4Enabled)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                  tpGa4Enabled
                    ? 'bg-brand text-on-brand'
                    : 'bg-surface-neutral text-ink-muted'
                }`}
              >
                {tpGa4Enabled ? 'Ativo' : 'Desativado'}
              </button>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-semibold text-ink">
                ID da Métrica GA4
              </label>
              <input
                type="text"
                value={tpGa4Id}
                onChange={(e) => setTpGa4Id(sanitizeGoogleTagId(e.target.value))}
                placeholder="G-XXXXXXXXXX"
                className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2 font-mono text-xs text-ink focus:border-brand focus:outline-none sm:max-w-sm"
              />
            </div>
          </div>

          {/* 3. Google Ads (Conversões & Remarketing) */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-ink">
                  Google Ads (Conversões & Remarketing)
                </h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Rastreia remarketing e conversões de cliques no WhatsApp e solicitações de revisão.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={tpAdsEnabled}
                onClick={() => setTpAdsEnabled(!tpAdsEnabled)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                  tpAdsEnabled
                    ? 'bg-brand text-on-brand'
                    : 'bg-surface-neutral text-ink-muted'
                }`}
              >
                {tpAdsEnabled ? 'Ativo' : 'Desativado'}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-ink">
                  ID da Tag do Google Ads
                </label>
                <input
                  type="text"
                  value={tpAdsId}
                  onChange={(e) => setTpAdsId(sanitizeGoogleTagId(e.target.value))}
                  placeholder="AW-123456789"
                  className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2 font-mono text-xs text-ink focus:border-brand focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink">
                  Rótulo de Conversão de Lead / WhatsApp (opcional)
                </label>
                <input
                  type="text"
                  value={tpAdsLabel}
                  onChange={(e) => setTpAdsLabel(sanitizeGoogleConversionLabel(e.target.value))}
                  placeholder="AbCdEfGhIjKlMnOpQr"
                  className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2 font-mono text-xs text-ink focus:border-brand focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 4. Meta Pixel (Facebook & Instagram) */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-ink">
                  Meta Pixel (Facebook & Instagram)
                </h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Dispara <code className="font-mono">PageView</code>, <code className="font-mono">ViewContent</code> e <code className="font-mono">Lead / Contact</code> automaticamente nas ações públicas.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={tpMetaEnabled}
                onClick={() => setTpMetaEnabled(!tpMetaEnabled)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                  tpMetaEnabled
                    ? 'bg-brand text-on-brand'
                    : 'bg-surface-neutral text-ink-muted'
                }`}
              >
                {tpMetaEnabled ? 'Ativo' : 'Desativado'}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-ink">
                  ID do Pixel da Meta
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={tpMetaId}
                  onChange={(e) => setTpMetaId(sanitizePixelId(e.target.value))}
                  placeholder="123456789012345"
                  className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2 font-mono text-xs text-ink focus:border-brand focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink">
                  Código de verificação de domínio da Meta (opcional)
                </label>
                <input
                  type="text"
                  value={tpMetaDomain}
                  onChange={(e) => setTpMetaDomain(e.target.value)}
                  placeholder="Ex.: abcdef1234567890ghijkl"
                  className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2 font-mono text-xs text-ink focus:border-brand focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-ink">
                  Token da Conversions API / CAPI (opcional — armazenado apenas no servidor)
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type={showMetaCapi ? 'text' : 'password'}
                    value={tpMetaNewCapi}
                    onChange={(e) => {
                      setTpMetaNewCapi(e.target.value);
                      if (e.target.value) setTpMetaClearCapi(false);
                    }}
                    placeholder={
                      tpMetaClearCapi
                        ? 'Token será removido ao salvar'
                        : incomingTp.meta_pixel.has_capi_token
                          ? `Token salvo (${incomingTp.meta_pixel.capi_token_masked}) — digite apenas para substituir`
                          : 'Cole aqui o token secreto da Conversions API (CAPI)'
                    }
                    className="flex-1 rounded-xl border border-border bg-card px-3.5 py-2 font-mono text-xs text-ink focus:border-brand focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMetaCapi(!showMetaCapi)}
                    aria-label="Mostrar ou ocultar token CAPI"
                    className="rounded-xl border border-border bg-card p-2 text-ink-muted hover:bg-surface-neutral hover:text-ink"
                  >
                    {showMetaCapi ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTpMetaNewCapi('');
                      setTpMetaClearCapi(true);
                    }}
                    aria-label="Limpar token CAPI"
                    className="rounded-xl border border-border bg-card p-2 text-ink-muted hover:bg-brand-soft hover:text-brand-text"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 5. TikTok Pixel */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-ink">TikTok Pixel</h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Dispara eventos de visualização de página, modelos e conversão de contato no TikTok Ads.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={tpTtEnabled}
                onClick={() => setTpTtEnabled(!tpTtEnabled)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                  tpTtEnabled
                    ? 'bg-brand text-on-brand'
                    : 'bg-surface-neutral text-ink-muted'
                }`}
              >
                {tpTtEnabled ? 'Ativo' : 'Desativado'}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-ink">
                  ID do Pixel do TikTok
                </label>
                <input
                  type="text"
                  value={tpTtId}
                  onChange={(e) => setTpTtId(sanitizeTikTokPixelId(e.target.value))}
                  placeholder="CXXXXXXXXXXXXXXXXX"
                  className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2 font-mono text-xs text-ink focus:border-brand focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink">
                  Token da Events API (opcional — armazenado apenas no servidor)
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type={showTtToken ? 'text' : 'password'}
                    value={tpTtNewToken}
                    onChange={(e) => {
                      setTpTtNewToken(e.target.value);
                      if (e.target.value) setTpTtClearToken(false);
                    }}
                    placeholder={
                      tpTtClearToken
                        ? 'Token será removido ao salvar'
                        : incomingTp.tiktok_pixel.has_events_token
                          ? `Token salvo (${incomingTp.tiktok_pixel.events_token_masked}) — digite apenas para substituir`
                          : 'Cole aqui o token da Events API'
                    }
                    className="flex-1 rounded-xl border border-border bg-card px-3.5 py-2 font-mono text-xs text-ink focus:border-brand focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTtToken(!showTtToken)}
                    aria-label="Mostrar ou ocultar token TikTok"
                    className="rounded-xl border border-border bg-card p-2 text-ink-muted hover:bg-surface-neutral hover:text-ink"
                  >
                    {showTtToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTpTtNewToken('');
                      setTpTtClearToken(true);
                    }}
                    aria-label="Limpar token TikTok"
                    className="rounded-xl border border-border bg-card p-2 text-ink-muted hover:bg-brand-soft hover:text-brand-text"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          {/* 6. Google Search Console (Verificação de Domínio) */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <div>
              <h3 className="text-sm font-bold text-ink">
                Google Search Console (Verificação de Domínio)
              </h3>
              <p className="mt-0.5 text-xs text-ink-muted">
                Injeta automaticamente a meta tag{' '}
                <code className="font-mono">
                  &lt;meta name=&quot;google-site-verification&quot; content=&quot;...&quot; /&gt;
                </code>{' '}
                no <code className="font-mono">&lt;head&gt;</code> das páginas públicas quando preenchido.
              </p>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-semibold text-ink">
                Código de verificação ou tag HTML completa
              </label>
              <input
                type="text"
                value={tpGscVerification}
                onChange={(e) => setTpGscVerification(e.target.value)}
                placeholder='<meta name="google-site-verification" content="seu-codigo" /> ou apenas o código'
                className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2 font-mono text-xs text-ink focus:border-brand focus:outline-none"
              />
              {tpGscVerification.trim() &&
              (/<meta\b/i.test(tpGscVerification) || /\bcontent\s*=/i.test(tpGscVerification)) &&
              extractedGscCode ? (
                <p className="mt-1.5 text-[11px] font-medium text-brand-text">
                  Código extraído automaticamente: <code className="font-mono font-semibold">{extractedGscCode}</code>
                </p>
              ) : (
                <p className="mt-1.5 text-[11px] text-ink-muted">
                  Cole a tag HTML completa fornecida pelo Google Search Console ou apenas o valor do atributo <code className="font-mono">content</code>.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Eventos padrão rastreados automaticamente */}
        <div className="mt-4 rounded-xl border border-border bg-surface-neutral p-3.5 text-xs text-ink-muted">
          <p className="font-bold text-ink">
            Eventos padrão rastreados automaticamente (quando ativos):
          </p>
          <ul className="mt-1.5 space-y-1">
            <li>
              • <span className="font-semibold text-ink">Visualização de página (PageView):</span> disparado nas páginas públicas (nunca nas rotas <code className="font-mono">/gestor</code>).
            </li>
            <li>
              • <span className="font-semibold text-ink">Visualização de produto/modelo (ViewContent):</span> disparado ao selecionar modelos, revisões ou segmentos na tabela de preços.
            </li>
            <li>
              • <span className="font-semibold text-ink">Conversão / Contato (Lead / Contact):</span> disparado ao clicar nos botões de WhatsApp e agendamento de revisão.
            </li>
          </ul>
        </div>
      </div>

      <p className="text-center text-xs text-ink-muted">
        Sem chaves configuradas, o site continua funcionando com os dados e preços cadastrados manualmente no gestor.
      </p>
    </div>
  );
}
