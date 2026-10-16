export const MASTER_ADMIN_EMAILS = [
  'robert.f.telekom@gmail.com',
  'robert_f_telekom@gmail.com',
];

export const TITAN_LIFETIME_EMAILS = [
  'sh00trs.tv@gmail.com',
  'sh00trs.tv@outlook.de',
  'twoandahalfeafc@gmail.com',
];

export const MASTER_ADMIN_PASSWORD = 'admin';
export const TWOANDAHALFEAFC_PASSWORD = 'vip';

export function isMasterAdmin(email?: string, channelName?: string): boolean {
  if (!email && !channelName) return false;
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanChannel = (channelName || '').trim().toLowerCase();

  return (
    MASTER_ADMIN_EMAILS.some((e) => e.toLowerCase() === cleanEmail) ||
    cleanChannel === 'robert_f_telekom' ||
    cleanChannel === 'admin'
  );
}

export function checkIsVip(channelName?: string, email?: string): boolean {
  if (!channelName && !email) return false;
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanChannel = (channelName || '').trim().toLowerCase();

  if (isMasterAdmin(email, channelName)) return true;

  return (
    TITAN_LIFETIME_EMAILS.some((e) => e.toLowerCase() === cleanEmail) ||
    cleanChannel === 'sh00trs' ||
    cleanChannel === 'sh00trstv' ||
    cleanChannel === 'twoandahalfeafc'
  );
}
