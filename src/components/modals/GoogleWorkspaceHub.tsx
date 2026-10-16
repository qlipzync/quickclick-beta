import React from 'react';
import { FileSpreadsheet, Cloud, ExternalLink, Sparkles, Check } from 'lucide-react';
import { StreamerUser } from '../../types/pipeline';

interface GoogleWorkspaceHubProps {
  user: StreamerUser;
  isOpen?: boolean;
}

export const GoogleWorkspaceHub: React.FC<GoogleWorkspaceHubProps> = ({ user }) => {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 space-y-6">
      <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
        <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <FileSpreadsheet className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white font-display">
            Google Workspace & Drive Integration
          </h3>
          <p className="text-xs text-zinc-400">
            Automatischer Protokollabgleich mit Google Drive & Google Sheets (Zero-Storage).
          </p>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-white">Google Sheets Master Log</h4>
            <p className="text-[11px] text-zinc-400">
              {user.googleSheetId ? `Tabelle bereitgestellt: ${user.googleSheetId}` : 'Bereit zur Duplizierung'}
            </p>
          </div>
          {user.googleSheetUrl && (
            <a
              href={user.googleSheetUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition"
            >
              <span>Sheet öffnen</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
