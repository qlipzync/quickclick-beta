import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStripe } from './stripe.js';

export const extraClipsRouter = Router();

const FIRESTORE_DB_ID =
  process.env.FIRESTORE_DB || 'ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91';
const db = getFirestore(FIRESTORE_DB_ID);

const EMAIL_ACTION_SECRET =
  process.env.EMAIL_ACTION_SECRET ||
  process.env.TWITCH_WEBHOOK_SECRET ||
  'qlipzync_email_action_secret_2026';

/**
 * Validates HMAC token for email and web action links
 */
export function verifyEmailActionToken(userId: string, streamId: string, token: string): boolean {
  if (!userId || !streamId || !token) return false;
  const expectedToken = crypto
    .createHmac('sha256', EMAIL_ACTION_SECRET)
    .update(`${userId}_${streamId}`)
    .digest('hex');

  try {
    const expectedBuf = Buffer.from(expectedToken);
    const tokenBuf = Buffer.from(token);
    if (expectedBuf.length !== tokenBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, tokenBuf);
  } catch {
    return false;
  }
}

/**
 * Generates HMAC token for email action links
 */
export function generateEmailActionToken(userId: string, streamId: string): string {
  return crypto
    .createHmac('sha256', EMAIL_ACTION_SECRET)
    .update(`${userId}_${streamId}`)
    .digest('hex');
}

/**
 * ALL /api/extra-clips/handle (Canonical)
 * Aliases: /api/handle-extra-clips, /handle-extra-clips
 * Processes the dynamic extra clip request directly from email form or fallback web form.
 */
extraClipsRouter.all(
  ['/api/extra-clips/handle', '/api/handle-extra-clips', '/handle-extra-clips'],
  async (req: Request, res: Response) => {
  const streamId = (req.query.stream_id || req.body?.stream_id) as string;
  const userId = (req.query.user_id || req.body?.user_id) as string;
  const rawCount = (req.query.count || req.body?.count) as string;
  const token = (req.query.token || req.body?.token) as string;

  if (!streamId || !userId || !token) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html lang="de">
      <head><meta charset="utf-8"><title>QlipZync • Fehler</title><style>body{background:#0e0e10;color:#fff;font-family:sans-serif;padding:40px;text-align:center;}</style></head>
      <body><h2>Fehlerhafte Anfrage</h2><p>Fehlende Parameter (stream_id, user_id oder token).</p></body>
      </html>
    `);
  }

  // 1. Token validieren
  if (!verifyEmailActionToken(userId, streamId, token)) {
    return res.status(403).send(`
      <!DOCTYPE html>
      <html lang="de">
      <head><meta charset="utf-8"><title>QlipZync • Zugriff verweigert</title><style>body{background:#0e0e10;color:#fff;font-family:sans-serif;padding:40px;text-align:center;}</style></head>
      <body><h2>Ungültiger oder abgelaufener Aktions-Link</h2><p>Der kryptografische Sicherheits-Token stimmt nicht überein.</p></body>
      </html>
    `);
  }

  const clipCount = parseInt(rawCount, 10);
  if (isNaN(clipCount) || clipCount < 0) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html lang="de">
      <head><meta charset="utf-8"><title>QlipZync • Fehler</title><style>body{background:#0e0e10;color:#fff;font-family:sans-serif;padding:40px;text-align:center;}</style></head>
      <body><h2>Ungültige Anzahl angegeben</h2><p>Bitte gib eine Zahl von 0 bis zur maximalen Anzahl an.</p></body>
      </html>
    `);
  }

  try {
    const pendingStreamRef = db
      .collection('users')
      .doc(userId)
      .collection('pending_streams')
      .doc(streamId);

    // =========================================================================
    // FALL 1: Eingabe ist 0 -> System schläft weiter!
    // =========================================================================
    if (clipCount === 0) {
      await pendingStreamRef.set(
        {
          status: 'dismissed_by_user',
          selectedClipsCount: 0,
          dismissedAt: FieldValue.serverTimestamp(),
          storageUsedMB: 0.0,
        },
        { merge: true }
      );

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(`
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QlipZync • Ruhemodus aktiv</title>
  <style>
    body {
      margin: 0;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #09090b;
      color: #fafafa;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      box-sizing: border-box;
      text-align: center;
    }
    .card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 20px;
      padding: 36px 28px;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7);
    }
    .icon-box {
      width: 56px;
      height: 56px;
      background: rgba(145, 70, 255, 0.12);
      border: 1px solid rgba(145, 70, 255, 0.35);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      color: #9146FF;
    }
    h1 { margin: 0 0 10px; font-size: 21px; font-weight: 700; color: #fff; }
    p { margin: 0 0 16px; font-size: 14px; color: #a1a1aa; line-height: 1.6; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
      font-size: 12px;
      font-weight: 600;
      border-radius: 9999px;
      margin-bottom: 24px;
    }
    .btn {
      display: inline-block;
      background: #9146FF;
      color: #fff;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      padding: 12px 24px;
      border-radius: 10px;
      transition: background 0.2s;
    }
    .btn:hover { background: #772ce8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-box">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
      </svg>
    </div>
    <div class="badge">
      <span>●</span> 0 Extra-Clips • Ruhemodus aktiviert
    </div>
    <h1>System schläft weiter 💤</h1>
    <p>
      Es wurden <strong>keine zusätzlichen Clips</strong> zur Verarbeitung eingereiht. Dein bestehendes Kontingent bleibt vollständig unberührt.
    </p>
    <p style="font-size: 13px; color: #71717a;">
      QlipZync wacht beim nächsten Livestream (via Twitch EventSub) automatisch wieder auf.
    </p>
    <a href="/" class="btn">Zum Dashboard zurückkehren</a>
  </div>
</body>
</html>
      `);
    }

    // =========================================================================
    // FALL 2: Eingabe ist > 0 -> Clips verarbeiten oder Stripe Checkout anstoßen
    // =========================================================================
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data() || {};
    const availableExtraCredits = userData.usage?.extraCredits || userData.bonusClips || 0;

    if (availableExtraCredits >= clipCount) {
      // Streamer hat bereits bezahlte Extra-Credits -> direkt abziehen und starten!
      await db.collection('users').doc(userId).update({
        'usage.extraCredits': FieldValue.increment(-clipCount),
        'usage.usedClipsCurrentMonth': FieldValue.increment(clipCount),
      });

      await pendingStreamRef.set(
        {
          status: 'claimed',
          selectedClipsCount: clipCount,
          claimedAt: FieldValue.serverTimestamp(),
          paidVia: 'existing_credits',
        },
        { merge: true }
      );

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(`
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QlipZync • Clips werden gerendert</title>
  <style>
    body {
      margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #09090b; color: #fafafa; display: flex; align-items: center; justify-content: center; min-height: 100vh; box-sizing: border-box; text-align: center;
    }
    .card { background: #18181b; border: 1px solid #27272a; border-radius: 20px; padding: 36px 28px; max-width: 440px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7); }
    .icon-box { width: 56px; height: 56px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; color: #34d399; }
    h1 { margin: 0 0 10px; font-size: 21px; font-weight: 700; color: #fff; }
    p { margin: 0 0 16px; font-size: 14px; color: #a1a1aa; line-height: 1.6; }
    .btn { display: inline-block; background: #9146FF; color: #fff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 10px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-box">✓</div>
    <h1>${clipCount} Extra-Clips eingereiht! 🚀</h1>
    <p>Deine Clips werden jetzt im Zero-Storage RAM formatiert (9:16 blurred background), mit Gemini Flash analysiert und auf deinen verknüpften Kanälen veröffentlicht.</p>
    <a href="/" class="btn">Live-Verarbeitung im Dashboard ansehen</a>
  </div>
</body>
</html>
      `);
    }

    // Falls keine Extra-Credits vorhanden: Stripe Checkout Session für die exakte Anzahl erstellen
    const stripe = getStripe();
    const appBaseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const pricePerClipEur = 1.5; // 1,50 € pro On-Demand Clip
    const totalAmountCents = Math.round(clipCount * pricePerClipEur * 100);

    if (stripe) {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: userData.email || undefined,
        client_reference_id: userId,
        line_items: [
          {
            price_data: {
              currency: 'eur',
              product_data: {
                name: `${clipCount}x Extra Stream-Highlights (9:16 Video-Pipeline)`,
                description: `Vollautomatische Zero-Storage Formatierung, Gemini 2.5 Metadaten & Social Upload für ${clipCount} zusätzliche Clips.`,
              },
              unit_amount: totalAmountCents,
            },
            quantity: 1,
          },
        ],
        metadata: {
          userId,
          streamId,
          clipCount: String(clipCount),
          action: 'extra_clips_claim',
        },
        success_url: `${appBaseUrl}/?payment=success&stream_id=${streamId}&extra_clips=${clipCount}`,
        cancel_url: `${appBaseUrl}/select-clips?stream_id=${streamId}&user_id=${userId}&token=${token}&max=9`,
      });

      if (session.url) {
        return res.redirect(session.url);
      }
    }

    // Sandbox / Fallback ohne Live-Stripe
    await pendingStreamRef.set(
      {
        status: 'claimed',
        selectedClipsCount: clipCount,
        claimedAt: FieldValue.serverTimestamp(),
        paidVia: 'sandbox_simulation',
      },
      { merge: true }
    );

    return res.redirect(`/?payment=simulated&stream_id=${streamId}&extra_clips=${clipCount}`);
  } catch (error: any) {
    console.error('[handleExtraClips Error]', error);
    return res.status(500).send(`Server-Fehler: ${error.message}`);
  }
});

/**
 * GET /api/extra-clips/select (Canonical)
 * Aliases: /api/select-clips, /select-clips
 * Clean fallback web interface matching the email design for email clients that strip HTML forms.
 */
extraClipsRouter.get(
  ['/api/extra-clips/select', '/api/select-clips', '/select-clips'],
  (req: Request, res: Response) => {
  const streamId = req.query.stream_id as string;
  const userId = req.query.user_id as string;
  const token = req.query.token as string;
  const maxClips = Math.min(parseInt((req.query.max as string) || '9', 10), 20);

  if (!streamId || !userId || !token) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(`
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"><title>QlipZync • Fehler</title><style>body{background:#0e0e10;color:#fff;font-family:sans-serif;padding:40px;text-align:center;}</style></head>
      <body><h2>Ungültiger Aufruf</h2><p>Fehlende Parameter. Bitte verwende den Link aus deiner E-Mail.</p></body></html>
    `);
  }

  // Token validieren
  if (!verifyEmailActionToken(userId, streamId, token)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(403).send(`
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"><title>QlipZync • Zugriff verweigert</title><style>body{background:#0e0e10;color:#fff;font-family:sans-serif;padding:40px;text-align:center;}</style></head>
      <body><h2>Ungültiger oder abgelaufener Sicherheits-Token</h2></body></html>
    `);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QlipZync • Stream-Highlights freigeben</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #09090b;
      color: #fafafa;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 20px;
      padding: 32px 24px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8);
      text-align: center;
    }
    .header-icon {
      width: 52px;
      height: 52px;
      background: rgba(145, 70, 255, 0.15);
      border: 1px solid rgba(145, 70, 255, 0.4);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      color: #9146FF;
    }
    h1 { margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #fff; }
    p { margin: 0 0 20px; font-size: 14px; color: #a1a1aa; line-height: 1.5; }
    .box {
      background: #09090b;
      border: 1px solid #27272a;
      border-radius: 14px;
      padding: 20px;
      margin-bottom: 24px;
      text-align: left;
    }
    .preset-buttons {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .preset-btn {
      flex: 1;
      min-width: 50px;
      padding: 8px 12px;
      background: #27272a;
      color: #e4e4e7;
      border: 1px solid #3f3f46;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .preset-btn:hover {
      background: #9146FF;
      color: #fff;
      border-color: #9146FF;
    }
    .preset-btn.sleep {
      background: rgba(16, 185, 129, 0.15);
      border-color: rgba(16, 185, 129, 0.3);
      color: #34d399;
    }
    .preset-btn.sleep:hover {
      background: #10b981;
      color: #000;
    }
    .input-wrapper {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    input[type="number"] {
      width: 90px;
      padding: 10px 14px;
      background: #18181b;
      border: 1px solid #9146FF;
      border-radius: 8px;
      color: #fff;
      font-size: 16px;
      font-weight: 700;
      text-align: center;
    }
    .submit-btn {
      flex: 1;
      padding: 11px 18px;
      background: #9146FF;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.2s;
    }
    .submit-btn:hover {
      background: #772ce8;
    }
    .hint {
      font-size: 12px;
      color: #71717a;
      line-height: 1.4;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header-icon">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
      </svg>
    </div>
    <h1>Dein Stream ist beendet! 🎬</h1>
    <p>Deine gebuchten Standard-Clips wurden bereits vollautomatisch verarbeitet. Twitch hat noch <strong>${maxClips} weitere Highlights</strong> bereitgestellt.</p>

    <div class="box">
      <label style="display:block; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#9146FF; margin-bottom:8px;">
        Schnellauswahl:
      </label>
      <div class="preset-buttons">
        <button type="button" class="preset-btn sleep" onclick="selectCount(0)">0 (Ruhemodus)</button>
        <button type="button" class="preset-btn" onclick="selectCount(1)">1 Clip</button>
        <button type="button" class="preset-btn" onclick="selectCount(3)">3 Clips</button>
        <button type="button" class="preset-btn" onclick="selectCount(${maxClips})">Alle (${maxClips})</button>
      </div>

      <form action="/api/handle-extra-clips" method="GET">
        <input type="hidden" name="stream_id" value="${streamId}">
        <input type="hidden" name="user_id" value="${userId}">
        <input type="hidden" name="token" value="${token}">

        <div class="input-wrapper">
          <input
            id="count-input"
            type="number"
            name="count"
            min="0"
            max="${maxClips}"
            value="1"
            required
          />
          <button type="submit" class="submit-btn" id="submit-btn">Auswahl bestätigen</button>
        </div>
      </form>
      <div class="hint" id="hint-text">
        Tipp: Bei Eingabe <strong>0</strong> schläft das System sofort weiter. Es entstehen keine Kosten.
      </div>
    </div>
  </div>

  <script>
    function selectCount(val) {
      var input = document.getElementById('count-input');
      var btn = document.getElementById('submit-btn');
      var hint = document.getElementById('hint-text');
      input.value = val;
      if (val === 0) {
        btn.textContent = 'Ruhemodus aktivieren (0)';
        btn.style.background = '#10b981';
        hint.innerHTML = '✔ Das System schläft sofort weiter. Dein Kontingent bleibt 100% unberührt.';
      } else {
        btn.textContent = val + ' Extra-Clips freigeben';
        btn.style.background = '#9146FF';
        hint.innerHTML = '🚀 ' + val + ' Clips werden im Zero-Storage RAM formatiert und gepostet.';
      }
    }
    document.getElementById('count-input').addEventListener('input', function(e) {
      var val = parseInt(e.target.value, 10);
      selectCount(isNaN(val) ? 0 : val);
    });
  </script>
</body>
</html>`);
});
