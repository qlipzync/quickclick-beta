import { getValidToken, saveAccountIntegration, getAccountIntegration } from "./accountIntegrations.js";
const DEFAULT_TEMPLATE_SPREADSHEET_ID = process.env.GOOGLE_SHEET_TEMPLATE_ID || process.env.GOOGLE_SHEETS_PUBLIC_SPREADSHEET_ID || "1KfQ1RQXoXFaRIDJ76eRy8rmeV_BLP5NkYkiVaOyzqcw";
async function duplicateTemplateSheetForUser(userId, userName) {
  const templateId = process.env.GOOGLE_SHEET_TEMPLATE_ID || DEFAULT_TEMPLATE_SPREADSHEET_ID;
  const newTitle = `QuickClick Master Clip Log - ${userName || "Creator"}`;
  try {
    const tokenResult = await getValidToken(userId, "google");
    if (!tokenResult.valid || !tokenResult.accessToken) {
      console.warn(`[Google Workspace] Kein valides Google-Token f\xFCr User ${userId}. Verwende Vorlagen-Link.`);
      const fallbackUrl = `https://docs.google.com/spreadsheets/d/${templateId}/edit`;
      return {
        success: true,
        spreadsheetId: templateId,
        spreadsheetUrl: fallbackUrl,
        title: newTitle
      };
    }
    console.log(`\u{1F4D1} [Google Drive] Kopiere Vorlage '${templateId}' als '${newTitle}' f\xFCr User ${userId}...`);
    const copyRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(templateId)}/copy?supportsAllDrives=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenResult.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: newTitle,
          description: `Automatisch generiertes QuickClick Dashboard f\xFCr ${userName}`
        })
      }
    );
    const copyData = await copyRes.json();
    if (!copyRes.ok || !copyData.id) {
      console.error("[Google Drive API Copy Error]", copyData);
      throw new Error(copyData.error?.message || `Fehler beim Kopieren der Vorlage (HTTP ${copyRes.status})`);
    }
    const generatedSpreadsheetId = copyData.id;
    const generatedSpreadsheetUrl = `https://docs.google.com/spreadsheets/d/${generatedSpreadsheetId}/edit`;
    const existing = getAccountIntegration(userId, "google");
    await saveAccountIntegration(userId, "google", {
      accessToken: tokenResult.accessToken,
      scopes: existing?.scopes,
      accountUserId: existing?.accountUserId,
      accountUserName: existing?.accountUserName,
      accountEmail: existing?.accountEmail,
      spreadsheetId: generatedSpreadsheetId,
      spreadsheetUrl: generatedSpreadsheetUrl
    });
    console.log(`\u2705 [Google Drive] Vorlage erfolgreich dupliziert: ID=${generatedSpreadsheetId}, URL=${generatedSpreadsheetUrl}`);
    return {
      success: true,
      spreadsheetId: generatedSpreadsheetId,
      spreadsheetUrl: generatedSpreadsheetUrl,
      title: newTitle
    };
  } catch (err) {
    console.error("[Google Workspace] Duplizierungs-Fehler:", err);
    return {
      success: false,
      spreadsheetId: templateId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${templateId}/edit`,
      title: newTitle,
      error: err.message
    };
  }
}
async function fetchLiveSpreadsheetData(userId, range = "QuickClick_Clips_Master!A2:J50") {
  const existing = getAccountIntegration(userId, "google");
  const spreadsheetId = existing?.spreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID || process.env.GOOGLE_SHEET_TEMPLATE_ID || DEFAULT_TEMPLATE_SPREADSHEET_ID;
  try {
    const tokenResult = await getValidToken(userId, "google");
    if (tokenResult.valid && tokenResult.accessToken) {
      const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/${encodeURIComponent(range)}`;
      const res = await fetch(sheetsUrl, {
        headers: {
          Authorization: `Bearer ${tokenResult.accessToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          spreadsheetId,
          range: data.range || range,
          values: data.values || []
        };
      }
    }
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
            values: pData.values || []
          };
        }
      } catch {
      }
    }
    return {
      success: true,
      spreadsheetId,
      range,
      values: []
    };
  } catch (err) {
    return {
      success: false,
      spreadsheetId,
      range,
      values: [],
      error: err.message
    };
  }
}
export {
  DEFAULT_TEMPLATE_SPREADSHEET_ID,
  duplicateTemplateSheetForUser,
  fetchLiveSpreadsheetData
};
