import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Key, Lock, CheckCircle2, Copy, Check, AlertTriangle, RefreshCw, Smartphone } from 'lucide-react';
import { StreamerUser } from '../../types/pipeline';
import { syncUserToFirestore } from '../../lib/firebase';

interface TwoFactorAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: StreamerUser;
  onUpdateUser: (updated: StreamerUser) => void;
}

export const TwoFactorAuthModal: React.FC<TwoFactorAuthModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateUser,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [code, setCode] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [otpAuthUrl, setOtpAuthUrl] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [success, setSuccess] = useState(false);

  const isEnabled = Boolean(user.twoFactorEnabled || user.twoFactorAuth?.isEnabled);

  // Generate real TOTP Secret when starting setup
  const init2FASetup = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/auth/2fa/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelName: user.channelName || user.displayName || 'streamer',
          userId: user.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Fehler beim Initialisieren des 2FA-Schlüssels');
      }

      const data = await response.json();
      setSecretKey(data.secretKey || '');
      setOtpAuthUrl(data.otpAuthUrl || '');
      setBackupCodes(data.backupCodes || []);
      setStep(2);
    } catch (err: any) {
      setErrorMessage(err.message || 'Verbindungsfehler beim Erstellen des 2FA-Schlüssels.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = () => {
    if (isEnabled) {
      // Disable 2FA
      const updated: StreamerUser = {
        ...user,
        twoFactorEnabled: false,
        twoFactorAuth: { isEnabled: false, isVerified: false, method: 'email_code' },
        updatedAt: new Date().toISOString(),
      };
      onUpdateUser(updated);
      syncUserToFirestore(updated);
      onClose();
    } else {
      init2FASetup();
    }
  };

  const handleVerify = async () => {
    const cleanCode = code.trim();
    if (cleanCode.length !== 6 && !backupCodes.includes(cleanCode)) {
      setErrorMessage('Bitte gib den 6-stelligen Zahlencode aus deiner Authenticator-App ein.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          secret: secretKey,
          backupCodes,
          userId: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.verified) {
        throw new Error(data.error || 'Ungültiger Authentifizierungscode.');
      }

      const updated: StreamerUser = {
        ...user,
        twoFactorEnabled: true,
        twoFactorAuth: {
          isEnabled: true,
          isVerified: true,
          method: 'authenticator_app',
          secretKey,
          backupCodes,
        },
        updatedAt: new Date().toISOString(),
      };

      onUpdateUser(updated);
      await syncUserToFirestore(updated);

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1800);
    } catch (err: any) {
      setErrorMessage(err.message || 'Verifizierung fehlgeschlagen.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySecret = () => {
    if (secretKey) {
      navigator.clipboard.writeText(secretKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-auto w-full max-w-lg rounded-3xl border border-purple-500/30 bg-gradient-to-b from-[#130a2a] to-[#080518] p-6 sm:p-8 shadow-2xl space-y-6 text-zinc-100 backdrop:bg-black/80 backdrop:backdrop-blur-md block my-auto"
    >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white transition p-1 cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-600/20 border border-purple-500/40 text-purple-300">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-bold font-display text-white">
            Zwei-Faktor-Authentifizierung (2FA / RFC 6238)
          </h3>
          <p className="text-xs text-zinc-400">
            Schütze deinen Creator-Account vor unbefugtem Zugriff auf Streaming-, YouTube- und Twitch-Tokens.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2.5 text-xs text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {success ? (
          <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto animate-bounce" />
            <h4 className="text-base font-bold text-white">2FA erfolgreich aktiviert!</h4>
            <p className="text-xs text-emerald-300">
              Dein Account ist jetzt mit RFC 6238 TOTP geschützt. Bei künftigen Logins wird der Code abgefragt.
            </p>
          </div>
        ) : step === 1 ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2 text-xs text-zinc-300">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">Status:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                    isEnabled
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {isEnabled ? 'Aktiviert (RFC 6238 TOTP)' : 'Deaktiviert'}
                </span>
              </div>
              <p className="text-zinc-400 leading-relaxed">
                Unterstützt Google Authenticator, Authy, 1Password, Bitwarden und alle Standard-TOTP-Apps.
              </p>
            </div>

            <button
              onClick={handleToggle}
              disabled={isLoading}
              className={`w-full py-3 rounded-xl font-bold text-xs sm:text-sm transition shadow-lg cursor-pointer flex items-center justify-center gap-2 ${
                isEnabled
                  ? 'bg-red-600/80 hover:bg-red-600 text-white'
                  : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30'
              }`}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Wird initialisiert...</span>
                </>
              ) : isEnabled ? (
                '2FA deaktivieren'
              ) : (
                '2FA jetzt einrichten'
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* QR Code and Secret Key Setup */}
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-purple-500/30 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-purple-300">
                <Smartphone className="h-4 w-4" />
                <span>1. Scanne den QR-Code oder gib den Schlüssel manuell ein</span>
              </div>

              {otpAuthUrl && (
                <div className="flex justify-center p-2 bg-white rounded-xl mx-auto w-fit">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(otpAuthUrl)}`}
                    alt="2FA QR Code"
                    className="w-36 h-36"
                  />
                </div>
              )}

              <div className="space-y-1">
                <span className="text-[11px] text-zinc-400 block">Manueller Einrichtungsschlüssel (Base32):</span>
                <div className="flex items-center gap-2 bg-black/60 p-2 rounded-lg border border-purple-500/20">
                  <code className="text-xs font-mono text-purple-300 font-bold flex-1 select-all tracking-wider">
                    {secretKey}
                  </code>
                  <button
                    onClick={handleCopySecret}
                    className="flex items-center gap-1 px-2 py-1 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 text-xs rounded transition cursor-pointer"
                  >
                    {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedKey ? 'Kopiert' : 'Kopieren'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 6-Digit Code Input */}
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center space-y-2">
              <span className="text-xs font-medium text-zinc-300 block">
                2. Gib den 6-stelligen Code aus deiner Authenticator-App ein:
              </span>
              <input
                type="text"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                autoFocus
                className="w-full text-center text-2xl tracking-[0.3em] font-mono py-2.5 rounded-xl bg-black/70 border border-purple-500/40 text-white focus:outline-none focus:border-purple-400 transition"
              />
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={() => setStep(1)}
                className="w-1/3 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer transition"
              >
                Zurück
              </button>
              <button
                onClick={handleVerify}
                disabled={isLoading || code.trim().length !== 6}
                className="w-2/3 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-purple-600/25 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Prüfen...</span>
                  </>
                ) : (
                  'Bestätigen & Aktivieren'
                )}
              </button>
            </div>
          </div>
        )}
    </dialog>
  );
};
