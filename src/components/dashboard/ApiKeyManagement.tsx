import React, { useState } from 'react';
import { useSubscription } from '../../hooks/useSubscription';
import { useApiKeys } from '../../hooks/useApiKeys';
import { Key, Copy, Check, ShieldAlert, Terminal, Lock, RefreshCw, AlertTriangle, Code2 } from 'lucide-react';

export const ApiKeyManagement: React.FC = () => {
  const { isSubscribed, isLoading: subLoading, initiateCheckout, isProcessingCheckout } = useSubscription();
  const {
    keys,
    newGeneratedKey,
    newKeyName,
    setNewKeyName,
    isLoading,
    actionLoading,
    error,
    createKey,
    revokeKey,
    clearGeneratedKey,
    refreshKeys,
  } = useApiKeys(isSubscribed);

  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const handleCopyKey = () => {
    if (newGeneratedKey) {
      navigator.clipboard.writeText(newGeneratedKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 3000);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim() || actionLoading) return;
    await createKey(newKeyName);
  };

  const curlExample = `curl -X POST https://qlipzync.web.app/api/v1/clips/trigger-sync \\
  -H "X-API-Key: ${newGeneratedKey || (keys.length > 0 ? keys[0].keyPrefix : 'qc_live_a1b2c3d4e5f6...')}" \\
  -H "Content-Type: application/json"`;

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(curlExample);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 3000);
  };

  if (subLoading) {
    return (
      <div className="p-8 border border-slate-800 rounded-2xl bg-slate-900/40 backdrop-blur-md flex items-center justify-center space-x-3 text-gray-300">
        <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
        <span>Abonnement-Berechtigung wird geprüft...</span>
      </div>
    );
  }

  // Subscription-Gate: Unabonnierte Benutzer können keine API-Schlüssel erstellen
  if (!isSubscribed) {
    return (
      <div className="p-8 border border-red-500/30 rounded-2xl bg-gradient-to-b from-slate-900/90 to-red-950/20 backdrop-blur-md shadow-2xl text-left">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4 text-red-400">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2 font-display">
          Drittanbieter-API Schlüssel (Abonnement erforderlich)
        </h3>
        <p className="text-gray-400 mb-6 text-sm leading-relaxed max-w-xl">
          Automatisierte Webhook-Trigger über OBS, Make.com, Python oder cURL stehen exklusiv aktiven SaaS-Abonnenten zur Verfügung. Benutzer nach der Registrierung haben standardmäßig Null-Zugriff auf Systemfunktionen, bis ein aktives Abonnement serverseitig verifiziert ist.
        </p>
        <button
          onClick={() => initiateCheckout('price_1Q_PRO_TIER')}
          disabled={isProcessingCheckout}
          className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl shadow-lg transition-all disabled:opacity-50 cursor-pointer text-sm"
        >
          {isProcessingCheckout ? 'Weiterleitung zu Stripe...' : 'Jetzt abonnieren & API freischalten'}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-6 text-left shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Key className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white font-display">
              API-Schlüssel Verwaltung (OBS, Make.com, Python & cURL)
            </h3>
          </div>
          <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
            Verbinde externe Automatisierungen über den Header <code className="text-cyan-400 font-mono bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">X-API-Key: qc_live_...</code>. Schlüssel werden serverseitig per SHA-256 gehasht.
          </p>
        </div>

        <button
          onClick={() => void refreshKeys()}
          className="self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Aktualisieren
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Neuer Schlüssel Generierungs-Banner (Nur einmalig sichtbar) */}
      {newGeneratedKey && (
        <div className="p-5 border border-emerald-500/40 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-emerald-950/20 space-y-3 relative overflow-hidden shadow-2xl">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <ShieldAlert className="w-5 h-5" />
            <span>Neuer API-Schlüssel generiert – Bitte jetzt kopieren!</span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            Aus Sicherheitsgründen wird dieser Schlüssel <span className="text-emerald-300 font-bold">nur ein einziges Mal</span> im Klartext angezeigt. In der Datenbank liegt ausschließlich ein irreversibler SHA-256-Hash.
          </p>

          <div className="flex items-center gap-2 bg-slate-950 border border-emerald-500/30 rounded-lg p-2.5">
            <input
              type="text"
              readOnly
              value={newGeneratedKey}
              className="flex-1 bg-transparent text-sm text-emerald-300 font-mono focus:outline-none select-all"
            />
            <button
              onClick={handleCopyKey}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold rounded transition border border-emerald-500/40 cursor-pointer"
            >
              {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copiedKey ? 'Kopiert!' : 'Kopieren'}
            </button>
            <button
              onClick={clearGeneratedKey}
              className="px-2.5 py-1.5 text-xs text-gray-400 hover:text-white transition cursor-pointer"
            >
              Schließen
            </button>
          </div>
        </div>
      )}

      {/* Formular zur Schlüsselerstellung */}
      <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Name des Clients (z. B. OBS Webhook, Make.com, Python)"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition"
          disabled={actionLoading}
        />
        <button
          type="submit"
          disabled={actionLoading || !newKeyName.trim()}
          className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow"
        >
          {actionLoading ? 'Erstelle...' : 'Schlüssel generieren'}
        </button>
      </form>

      {/* Liste der aktiven Schlüssel */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-300">Aktive Schlüssel</h4>
        {isLoading ? (
          <p className="text-sm text-gray-500">Lade Schlüssel...</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-gray-500">Noch keine API-Schlüssel hinterlegt.</p>
        ) : (
          <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
            {keys.map((k) => (
              <div key={k.id} className="p-4 flex items-center justify-between hover:bg-slate-900/40 transition">
                <div>
                  <div className="font-semibold text-sm text-white">{k.name}</div>
                  <div className="text-xs text-gray-400 font-mono mt-0.5">
                    {k.keyPrefix} • Erstellt: {k.createdAt ? new Date(k.createdAt).toLocaleDateString('de-DE') : '-'}
                    {k.lastUsedAt && ` • Zuletzt aktiv: ${new Date(k.lastUsedAt).toLocaleDateString('de-DE')}`}
                  </div>
                </div>
                <button
                  onClick={() => revokeKey(k.id)}
                  className="px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-colors cursor-pointer"
                >
                  Widerrufen
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* cURL / OBS Code Snippet Guide */}
      <div className="pt-2 border-t border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-300">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>Verwendung für Drittanbieter-Tools (z. B. cURL, OBS, Python)</span>
          </div>
          <button
            onClick={handleCopyCurl}
            className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 cursor-pointer"
          >
            {copiedCurl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedCurl ? 'Kopiert' : 'Befehl kopieren'}
          </button>
        </div>

        <div className="bg-black/70 border border-slate-800 rounded-xl p-3 font-mono text-xs text-cyan-300 overflow-x-auto">
          <pre>{curlExample}</pre>
        </div>
        <p className="text-[11px] text-gray-500 leading-normal">
          Die Middleware fängt den SHA-256-Hash ab, verifiziert das aktive Abonnement und isoliert den Job strikt auf die Daten des jeweiligen Nutzers.
        </p>
      </div>
    </div>
  );
};
