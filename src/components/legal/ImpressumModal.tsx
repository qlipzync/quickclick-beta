import React from 'react';
import { X, Scale, ShieldCheck } from 'lucide-react';
import { GCP_PROJECT_METADATA } from '../../config/quickclick-config';

interface ImpressumModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImpressumModal: React.FC<ImpressumModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-purple-500/30 bg-[#0c0620] p-6 sm:p-8 text-zinc-200 shadow-2xl space-y-6 backdrop:bg-black/80 backdrop:backdrop-blur-md block my-auto text-left"
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
        <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-purple-400 uppercase">
          <Scale className="h-3.5 w-3.5" /> RECHTLICHE ANGABEN (§ 5 DDG / TMG)
        </div>
        <h3 className="text-2xl font-black font-display text-white">Impressum</h3>
      </div>

      <div className="space-y-4 text-xs text-zinc-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
        <div>
          <h4 className="font-bold text-white text-sm mb-1">Angaben gemäß § 5 DDG:</h4>
          <p className="font-semibold text-white">QlipZync Cloud Technologies</p>
          <p>Ein Projekt der {GCP_PROJECT_METADATA.organization}</p>
          <p>Verantwortlicher Betreiber: Robert F.</p>
        </div>

        <div>
          <h4 className="font-bold text-white text-sm mb-1">Kontakt:</h4>
          <p>E-Mail: <span className="text-purple-400 font-mono">{GCP_PROJECT_METADATA.supportEmail}</span></p>
          <p>Technischer Dienst: Google Cloud Platform (Region {GCP_PROJECT_METADATA.defaultRegion})</p>
        </div>

        <div>
          <h4 className="font-bold text-white text-sm mb-1">Haftung für Inhalte:</h4>
          <p>
            Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten
            nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als
            Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde
            Informationen zu überwachen.
          </p>
        </div>

        <div>
          <h4 className="font-bold text-white text-sm mb-1">Haftung für Links:</h4>
          <p>
            Unser Angebot enthält Links zu externen Websites Dritter (z. B. Twitch, TikTok, YouTube),
            auf deren Inhalte wir keinen Einfluss haben. Für die Inhalte der verlinkten Seiten ist stets
            der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
          </p>
        </div>

        <div>
          <h4 className="font-bold text-white text-sm mb-1">Urheberrecht & Zero-Storage Garantie:</h4>
          <p>
            Die durch die Seitenbetreiber erstellten Inhalte unterliegen dem deutschen Urheberrecht.
            Alle im Zuge der Pipeline erstellten Clips und Metadaten gehören uneingeschränkt dem
            jeweiligen Streamer. QlipZync speichert zu keinem Zeitpunkt Video-Rohdaten auf persistenten
            Festplatten (Zero-Storage RAM processing in /dev/shm).
          </p>
        </div>
      </div>

      <div className="pt-2 border-t border-purple-500/20 flex justify-end">
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
