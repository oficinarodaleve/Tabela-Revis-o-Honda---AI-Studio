import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { CustomIntegration, IntegrationsData } from '../../types';
import { adminFetch } from '../../utils/adminAuth';
import { formatDateTimeBR } from '../../utils/pricing';

interface TabIntegrationsProps {
  integrations: IntegrationsData;
  onSaved: () => Promise<void>;
  onToast: (type: 'success' | 'error', msg: string) => void;
}

export function TabIntegrations({
  integrations,
  onSaved,
  onToast,
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
  }, [integrations]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      });
      if (!res.ok) throw new Error('Erro ao salvar integrações.');
      setMwNewToken('');
      await onSaved();
      onToast('success', 'Configurações de integrações e APIs salvas.');
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
          <h1 className="font-display text-2xl font-bold text-neutral-900">
            Integrações & APIs
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Configure Google Maps, sincronização automática com o ERP MicroWork e webhooks externos.
          </p>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="inline-flex items-center gap-2 self-start rounded-xl bg-[#E4002B] px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#C80024] disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>

      {/* Card 1: Google Maps */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-neutral-900">
              Integração Google Maps
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              Desativada, o site mostra um link direto para o Google Maps.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMapsActive(!mapsActive)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
              mapsActive
                ? 'bg-emerald-600 text-white'
                : 'bg-neutral-200 text-neutral-700'
            }`}
          >
            {mapsActive ? 'Ativo' : 'Inativo'}
          </button>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-semibold text-neutral-700">
            Chave da API Google Maps (opcional — sobrescreve a chave do ambiente)
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type={showMapsKey ? 'text' : 'password'}
              value={mapsKey}
              onChange={(e) => setMapsKey(e.target.value)}
              placeholder="Usando chave provisionada do projeto (ou cole AIza...)"
              className="flex-1 rounded-xl border border-neutral-200 px-3.5 py-2 font-mono text-xs text-neutral-900 focus:border-[#E4002B] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowMapsKey(!showMapsKey)}
              aria-label="Mostrar ou ocultar chave"
              className="rounded-xl border border-neutral-200 bg-white p-2 text-neutral-600 hover:bg-neutral-50"
            >
              {showMapsKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setMapsKey('')}
              aria-label="Limpar chave"
              className="rounded-xl border border-neutral-200 bg-white p-2 text-neutral-400 hover:bg-neutral-50 hover:text-[#E4002B]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-[11px] text-neutral-500">
            Restrinja a chave por domínio no Google Cloud. Ela fica visível no código do site, como toda chave de mapa.
          </p>
        </div>
      </div>

      {/* Card 2: Preços e estoque (ERP MicroWork) */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-neutral-900">
              Preços e estoque (ERP da oficina — MicroWork)
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              Atualiza os preços das peças automaticamente a partir do seu ERP sem expor o token no front-end.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMwAuto(!mwAuto)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
              mwAuto ? 'bg-emerald-600 text-white' : 'bg-neutral-200 text-neutral-700'
            }`}
          >
            {mwAuto ? 'Ligada' : 'Desligada'}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-neutral-700">
              Modo de atualização
            </label>
            <select
              value={mwMode}
              onChange={(e) => setMwMode(e.target.value as 'manual' | 'auto_api')}
              className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs font-medium text-neutral-900 focus:border-[#E4002B] focus:outline-none"
            >
              <option value="auto_api">Automático via API (MicroWork)</option>
              <option value="manual">Manual</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700">
              Frequência de atualização
            </label>
            <select
              value={mwFreq}
              onChange={(e) => setMwFreq(e.target.value as 'daily' | 'weekly')}
              className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs font-medium text-neutral-900 focus:border-[#E4002B] focus:outline-none"
            >
              <option value="weekly">Semanalmente (padrão)</option>
              <option value="daily">Diariamente</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-neutral-700">
              URL do endpoint / webhook MicroWork
            </label>
            <input
              type="url"
              value={mwEndpoint}
              onChange={(e) => setMwEndpoint(e.target.value)}
              placeholder="https://api.microwork.com.br/v1/pecas/precos"
              className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3.5 py-2 font-mono text-xs text-neutral-900 focus:border-[#E4002B] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-neutral-700">
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
              className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3.5 py-2 font-mono text-xs text-neutral-900 focus:border-[#E4002B] focus:outline-none"
            />
          </div>
        </div>

        {/* Regra de mapeamento */}
        <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3.5 text-xs text-neutral-600">
          <p className="font-bold text-neutral-800">Regra de mapeamento:</p>
          <p className="mt-0.5">
            O preço é vinculado pelo código Honda da peça. Peças configuradas em modo Manual nunca são sobrescritas, e se a consulta falhar ou retornar zero/vazio, o último preço salvo é preservado.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={testing}
            onClick={handleTestConnection}
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-800 hover:bg-neutral-50 disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4 text-neutral-600" />
            {testing ? 'Testando...' : 'Testar Conexão'}
          </button>

          <button
            type="button"
            disabled={syncing}
            onClick={handleSyncNow}
            className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 px-4 py-2 text-xs font-bold text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar Preços Agora'}
          </button>
        </div>

        {testFeedback && (
          <div
            className={`mt-3 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
              testFeedback.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            {testFeedback.msg}
          </div>
        )}

        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-neutral-200 bg-neutral-50/70 p-3.5 text-xs">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div>
            <p className="font-bold text-neutral-800">
              Última sincronização: {formatDateTimeBR(integrations.microwork.last_sync_at)}
            </p>
            <p className="mt-0.5 text-neutral-600">
              {integrations.microwork.last_sync_result}
            </p>
          </div>
        </div>
      </div>

      {/* Card 3: Outras chaves e webhooks */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-bold text-neutral-900">
          Outras chaves e webhooks
        </h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Google Analytics (GA4), Pixel da Meta, webhook de leads ou Firebase.
        </p>

        <div className="mt-4 space-y-2.5">
          {customItems.length === 0 ? (
            <p className="text-xs text-neutral-400">
              Nenhuma integração adicional cadastrada.
            </p>
          ) : (
            customItems.map((item, idx) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50/40 p-3"
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
                    className="w-44 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-bold text-neutral-900 focus:border-[#E4002B] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={item.value}
                    onChange={(e) =>
                      setCustomItems((prev) =>
                        prev.map((it, i) => (i === idx ? { ...it, value: e.target.value } : it))
                      )
                    }
                    className="min-w-[200px] flex-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 font-mono text-xs text-neutral-800 focus:border-[#E4002B] focus:outline-none"
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
                        ? 'bg-emerald-600 text-white'
                        : 'bg-neutral-200 text-neutral-700'
                    }`}
                  >
                    {item.active ? 'Ativo' : 'Inativo'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCustomItems((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-[#E4002B]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-neutral-100 pt-4">
          <input
            type="text"
            value={newIntName}
            onChange={(e) => setNewIntName(e.target.value)}
            placeholder="Nome (ex.: Google Analytics GA4)"
            className="w-56 rounded-xl border border-neutral-200 px-3 py-2 text-xs text-neutral-900 focus:border-[#E4002B] focus:outline-none"
          />
          <input
            type="text"
            value={newIntValue}
            onChange={(e) => setNewIntValue(e.target.value)}
            placeholder="ID, chave ou URL do webhook..."
            className="min-w-[220px] flex-1 rounded-xl border border-neutral-200 px-3 py-2 font-mono text-xs text-neutral-900 focus:border-[#E4002B] focus:outline-none"
          />
          <button
            type="button"
            onClick={handleAddCustom}
            className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 px-4 py-2 text-xs font-bold text-white hover:bg-neutral-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova Chave / Integração
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-neutral-500">
        Sem chaves configuradas, o site continua funcionando com os dados e preços cadastrados manualmente no gestor.
      </p>
    </div>
  );
}
