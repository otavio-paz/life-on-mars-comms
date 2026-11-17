export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const SOL_MS = 1.0274912517 * 86400000;
export function missionState(config, now = Date.now(), preview = 'auto') {
  const launch = Date.parse(config.launchAt), arrival = Date.parse(config.arrivalAt);
  const progress = Math.max(0, Math.min(1, (now - launch) / (arrival - launch)));
  const requiredSettlement = now >= Date.parse(config.settlementWindow?.startsAt) && now < Date.parse(config.settlementWindow?.endsAt);
  const settled = requiredSettlement || preview === 'settlement' || (preview === 'auto' && now >= arrival);
  return { settled, progress: settled ? 1 : progress, beforeLaunch: now < launch, day: Math.max(0, Math.floor((now - launch) / 86400000)), daysLeft: Math.max(0, Math.ceil((arrival - now) / 86400000)), sol: Math.max(1, Math.floor((now - arrival) / SOL_MS) + 1) };
}
// NASA Mars24, A-2, A-5 and C-2. TT-UTC and longitude are configurable.
export function marsTime(now, longitudeEast = 0, ttMinusUtc = 69.184) {
  const jdTT = 2440587.5 + now / 86400000 + ttMinusUtc / 86400;
  const msd = (jdTT - 2451549.5) / 1.0274912517 + 44796 - 0.0009626;
  const hours = ((24 * msd + longitudeEast / 15) % 24 + 24) % 24;
  const seconds = Math.floor(hours * 3600);
  return { msd, clock: [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':') };
}
export function deliveryAt(now = Date.now()) { return new Date(now + WEEK_MS).toISOString(); }
