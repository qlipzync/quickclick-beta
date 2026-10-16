import React from 'react';
import { X, Scale, FileText } from 'lucide-react';

interface TermsAndConditionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPrivacy?: () => void;
  onOpenImpressum?: () => void;
}

export const TermsAndConditionsModal: React.FC<TermsAndConditionsModalProps> = ({
  isOpen,
  onClose,
  onOpenPrivacy,
  onOpenImpressum,
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
          <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-purple-400 uppercase">
            <Scale className="h-3.5 w-3.5" /> VERTRAGSRECHT (BGB)
          </div>
          <h3 className="text-2xl font-black font-display text-white">
            Allgemeine Geschäftsbedingungen (AGB)
          </h3>
        </div>

        <div className="space-y-4 text-xs text-zinc-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
          <div>
            <h4 className="font-bold text-white text-sm mb-1">§ 1 Geltungsbereich:</h4>
            <p>
              Diese Geschäftsbedingungen gelten für alle Verträge über die Bereitstellung des
              SaaS-Dienstes QlipZync zwischen dem Anbieter und dem Kunden (Streamer / Content Creator).
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white text-sm mb-1">§ 2 Leistungsgegenstand:</h4>
            <p>
              QlipZync bietet eine autonome Videoclip-Extraktions- und Verteilungs-Pipeline für
              Livestreams (Twitch). Die Verarbeitung erfolgt vollautomatisiert in der Cloud Run Umgebung.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white text-sm mb-1">§ 3 Testphase & Abonnements:</h4>
            <p>
              Kunden der Stufe 2 Basic haben die Option auf eine 14-tägige kostenlose Testphase.
              Wird diese nicht vor Ablauf im Dashboard gekündigt, geht sie in ein monatlich kündbares
              Abonnement zum jeweils ausgewiesenen Preis über. Kündigungen sind jederzeit mit einem
              einzigen Klick im Dashboard wirksam.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white text-sm mb-1">§ 4 Urheberrechte an generierten Clips:</h4>
            <p>
              Der Streamer behält 100% aller Verwertungs- und Urheberrechte an den generierten Clips.
              QlipZync erhebt keinerlei Anspruch auf geistiges Eigentum oder Erlösbeteiligungen aus Social-Media-Kanälen.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white text-sm mb-1">§ 5 Haftung:</h4>
            <p>
              Wir haften unbeschränkt für Vorsatz und grobe Fahrlässigkeit. Für leichte Fahrlässigkeit
              haften wir nur bei Verletzung einer wesentlichen Vertragspflicht (Kardinalpflicht).
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
