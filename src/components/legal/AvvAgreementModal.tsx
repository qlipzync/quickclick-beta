import React from 'react';
import { X, FileCheck, ShieldCheck } from 'lucide-react';
import { StreamerUser } from '../../types/pipeline';
import { GCP_PROJECT_METADATA } from '../../config/quickclick-config';

interface AvvAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: StreamerUser | null;
  onOpenPrivacy?: () => void;
}

export const AvvAgreementModal: React.FC<AvvAgreementModalProps> = ({
  isOpen,
  onClose,
  user,
  onOpenPrivacy,
}) => {
  if (!isOpen) return null;

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-auto max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-fuchsia-500/40 bg-[#0c0620] p-6 sm:p-8 text-zinc-200 shadow-2xl space-y-6 backdrop:bg-black/80 backdrop:backdrop-blur-md block my-auto text-left"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-5 right-5 text-zinc-400 hover:text-white transition p-1 cursor-pointer"
        aria-label="Schließen"
      >
        <X className="h-5 w-5" />
      </button>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-fuchsia-400 uppercase">
            <FileCheck className="h-3.5 w-3.5" /> DSGVO ART. 28 AUFTRAGSVERARBEITUNG
          </div>
          <h3 className="text-2xl font-black font-display text-white">
            Vereinbarung zur Auftragsverarbeitung (AVV)
          </h3>
          <p className="text-xs text-zinc-400">
            Rechtskonforme Vereinbarung zwischen {GCP_PROJECT_METADATA.organization} und dem Auftraggeber{' '}
            <span className="text-fuchsia-300 font-semibold">{user?.displayName || user?.name || 'Streamer'}</span>.
          </p>
        </div>

        <div className="space-y-4 text-xs text-zinc-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
          <div>
            <h4 className="font-bold text-white text-sm mb-1">1. Gegenstand und Dauer des Auftrags:</h4>
            <p>
              Gegenstand ist die autonome Extraktion und Weiterleitung von Video-Highlights aus
              Twitch-Livestreams. Die Vereinbarung gilt für die Dauer der Registrierung.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white text-sm mb-1">2. Technisch-organisatorische Maßnahmen (TOMs):</h4>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li>Verarbeitung im flüchtigen RAM (/dev/shm) ohne Persistierung</li>
              <li>Hosting in zertifizierten Google Cloud Rechenzentren (ISO 27001, SOC 2)</li>
              <li>Ende-zu-Ende TLS 1.3 Transportverschlüsselung</li>
              <li>Strenge RBAC Firestore Sicherheitsregeln mit Default-Deny Catch-All</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white text-sm mb-1">3. Unterauftragsverarbeiter:</h4>
            <p>
              Als Unterauftragsverarbeiter werden herangezogen:
              Google Cloud Platform (Infrastruktur, Frankfurt europe-west3),
              Stripe Payments Europe Ltd. (Zahlungsabwicklung, Irland).
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-purple-500/20 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-xs cursor-pointer"
          >
            AVV bestätigen & Schließen
          </button>
        </div>
    </dialog>
  );
};
