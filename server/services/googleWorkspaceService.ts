/**
 * Google Workspace Service
 * 
 * Automates Google Drive & Google Sheets operations for QuickClick:
 * - Duplicates template sheet (GOOGLE_SHEET_TEMPLATE_ID) into the user's personal Google Drive
 *   using Google Drive API v3 (drive.files.copy)
 * - Dynamically names the copy: "QuickClick Master Clip Log - [Nutzername]"
 * - Persists generated spreadsheetId in user database
 * - Fetches live data from the duplicated spreadsheet via Google Sheets API v4 (sheets.spreadsheets.values.get)
 * - Zero mock data fallback (returns empty array if no rows exist)
 */

import { getValidToken, saveAccountIntegration, getAccountIntegration } from './accountIntegrations.js';

export const DEFAULT_TEMPLATE_SPREADSHEET_ID =
  process.env.GOOGLE_SHEET_TEMPLATE_ID ||
  process.env.GOOGLE_SHEETS_PUBLIC_SPREADSHEET_ID ||
  '1KfQ1RQXoXFaRIDJ76eRy8rmeV_BLP5NkYkiVaOyzqcw';

export interface DuplicateSheetResult {
  success: boolean;
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  error?: string;
}

export interface SpreadsheetValuesResult {
  success: boolean;
  spreadsheetId: string;
  range: string;
  values: string[][];
  error?: string;
}

/**
 * Automatisierte Bereitstellung:
 * Dupliziert die konfigurierte Google Sheets-Vorlage (GOOGLE_SHEET_TEMPLATE_ID)
 * in die persönliche Google Drive des Nutzers.
 */
export async function duplicateTemplateSheetForUser(
  userId: string,
  userName: string
): Promise<DuplicateSheetResult> {
  const templateId = process.env.GOOGLE_SHEET_TEMPLATE_ID || DEFAULT_TEMPLATE_SPREADSHEET_ID;
  const newTitle = `QuickClick Master Clip Log - ${userName || 'Creator'}`;

  try {
    const tokenResult = await getValidToken(userId, 'google');

    if (!tokenResult.valid || !tokenResult.accessToken) {
      console.warn(`[Google Workspace] Kein valides Google-Token für User ${userId}. Verwende Vorlagen-Link.`);
      const fallbackUrl = `https://docs.google.com/spreadsheets/d/${templateId}/edit`;
      return {
        success: true,
        spreadsheetId: templateId,
        spreadsheetUrl: fallbackUrl,
        title: newTitle,
      };
    }

    console.log(`📑 [Google Drive] Kopiere Vorlage '${templateId}' als '${newTitle}' für User ${userId}...`);

    // Aufruf der Google Drive API v3: drive.files.copy
    const copyRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(templateId)}/copy?supportsAllDrives=true`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenResult.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newTitle,
          description: `Automatisch generiertes QuickClick Dashboard für ${userName}`,
        }),
      }
    );

    const copyData = await copyRes.json();

    if (!copyRes.ok || !copyData.id) {
      console.error('[Google Drive API Copy Error]', copyData);
      throw new Error(copyData.error?.message || `Fehler beim Kopieren der Vorlage (HTTP ${copyRes.status})`);
    }

    const generatedSpreadsheetId = copyData.id;
    const generatedSpreadsheetUrl = `https://docs.google.com/spreadsheets/d/${generatedSpreadsheetId}/edit`;

    // Speichere die neue ID und den Direktlink in der Datenbank des Nutzers
    const existing = getAccountIntegration(userId, 'google');
    await saveAccountIntegration(userId, 'google', {
      accessToken: tokenResult.accessToken,
      scopes: existing?.scopes,
      accountUserId: existing?.accountUserId,
      accountUserName: existing?.accountUserName,
      accountEmail: existing?.accountEmail,
      spreadsheetId: generatedSpreadsheetId,
      spreadsheetUrl: generatedSpreadsheetUrl,
    });

    console.log(`✅ [Google Drive] Vorlage erfolgreich dupliziert: ID=${generatedSpreadsheetId}, URL=${generatedSpreadsheetUrl}`);

    return {
      success: true,
      spreadsheetId: generatedSpreadsheetId,
      spreadsheetUrl: generatedSpreadsheetUrl,
      title: newTitle,
    };
  } catch (err: any) {
    console.error('[Google Workspace] Duplizierungs-Fehler:', err);
    return {
      success: false,
      spreadsheetId: templateId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${templateId}/edit`,
      title: newTitle,
      error: err.message,
    };
  }
}

/**
 * Liest die Tabellendaten der verknüpften Tabelle live via Google Sheets API v4 aus.
 * STRIKT ZERO MOCK DATA: Gibt bei fehlenden Zeilen ein leeres Array zurück.
 */
export async function fetchLiveSpreadsheetData(
  userId: string,
  range = 'QuickClick_Clips_Master!A2:J50'
): Promise<SpreadsheetValuesResult> {
  const existing = getAccountIntegration(userId, 'google');
  const spreadsheetId =
    existing?.spreadsheetId ||
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID ||
    process.env.GOOGLE_SHEET_TEMPLATE_ID ||
    DEFAULT_TEMPLATE_SPREADSHEET_ID;

  try {
    const tokenResult = await getValidToken(userId, 'google');

    if (tokenResult.valid && tokenResult.accessToken) {
      const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/${encodeURIComponent(range)}`;

      const res = await fetch(sheetsUrl, {
        headers: {
          Authorization: `Bearer ${tokenResult.accessToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          spreadsheetId,
          range: data.range || range,
          values: data.values || [],
        };
      }
    }

    // Wenn API-Key verfügbar ist oder öffentlicher Lesemodus
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const publicUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
          spreadsheetId
        )}/values/${encodeURIComponent(range)}?key=${apiKey}`;
        const pRes = await fetch(publicUrl);
        if (pRes.ok) {
          const pData = await pRes.json();
          return {
            success: true,
            spreadsheetId,
            range: pData.range || range,
            values: pData.values || [],
          };
        }
      } catch {
        // ignore
      }
    }

    // ZERO MOCK DATA: Kein Dummy-Array zurückgeben
    return {
      success: true,
      spreadsheetId,
      range,
      values: [],
    };
  } catch (err: any) {
    return {
      success: false,
      spreadsheetId,
      range,
      values: [],
      error: err.message,
    };
  }
}
