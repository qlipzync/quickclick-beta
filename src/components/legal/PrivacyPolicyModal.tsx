import React from 'react';
import { X, ShieldCheck, FileCheck } from 'lucide-react';
import { GCP_PROJECT_METADATA } from '../../config/quickclick-config';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAvv?: () => void;
  onOpenTerms?: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
  isOpen,
  onClose,
  onOpenAvv,
  onOpenTerms,
}) => {
  if (!isOpen) return null;

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-auto max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-purple-500/30 bg-[#0c0620] p-6 sm:p-8 text-zinc-200 shadow-2xl space-y-6 backdrop:bg-black/80 backdrop:backdrop-blur-md block my-auto text-left"
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
          <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-400 uppercase">
            <ShieldCheck className="h-3.5 w-3.5" /> DSGVO / GDPR ART. 13 & 14
          </div>
          <h3 className="text-2xl font-black font-display text-white">Datenschutzerklärung</h3>
        </div>

        <div className="space-y-4 text-xs text-zinc-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
          <div>
            <h4 className="font-bold text-white text-sm mb-1">1. Verantwortliche Stelle:</h4>
            <p>
              Verantwortlich für die Datenverarbeitung auf dieser Plattform ist {GCP_PROJECT_METADATA.organization},
              E-Mail: <span className="text-purple-400 font-mono">{GCP_PROJECT_METADATA.supportEmail}</span>.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white text-sm mb-1">2. Zero-Storage Architektur & Datenvermeidung:</h4>
            <p>
              QlipZync arbeitet nach dem Grundsatz der strikten Datenminimierung (Art. 5 Abs. 1 lit. c DSGVO).
              Videodaten werden ausschließlich im flüchtigen Arbeitsspeicher (<code className="text-purple-300">/dev/shm</code>)
              temporär verarbeitet und nach der Extraktion und Transkodierung der Clips restlos vernichtet.
              Es findet zu keinem Zeitpunkt eine dauerhafte Speicherung von Videomaterial auf unseren Servern statt.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white text-sm mb-1">3. Erhebung & Verarbeitung von Kontodaten:</h4>
            <p>
              Bei Nutzung von Twitch OAuth speichern wir ausschließlich deine öffentliche Twitch Benutzer-ID,
              deinen Kanalnamen und dein Profilbild zur Authentifizierung und Sitzungsverwaltung in einer
              gesicherten Firestore-Instanz (Region {GCP_PROJECT_METADATA.defaultRegion}, Deutschland/EU).
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white text-sm mb-1">4. Zahlungsabwicklung via Stripe:</h4>
            <p>
              Zahlungsdaten (Kreditkarte, SEPA) werden direkt über Stripe Payments Europe, Ltd. verarbeitet.
              Wir selbst erlangen zu keinem Zeitpunkt Kenntnis über vollständige Kreditkartennummern oder Bankdaten.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white text-sm mb-1">5. Deine Rechte (Auskunft, Löschung, Widerruf):</h4>
            <p>
              Du hast das Recht auf unentgeltliche Auskunft über deine gespeicherten personenbezogenen Daten,
              deren Herkunft und Empfänger sowie das Recht auf Berichtigung, Sperrung oder Löschung dieser Daten.
              Du kannst deinen Account jederzeit eigenständig im Dashboard per DSGVO-Self-Service vollständig löschen.
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-purple-500/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-3 text-xs">
            {onOpenAvv && (
              <button onClick={onOpenAvv} className="text-fuchsia-400 hover:underline">
                AVV nach Art. 28 ansehen →
              </button>
            )}
            {onOpenTerms && (
              <button onClick={onOpenTerms} className="text-purple-400 hover:underline">
                AGB ansehen →
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer"
          >
            Schließen
          </button>
        </div>
    </dialog>
  );
};
