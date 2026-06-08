export interface MarketStatus {
  open: boolean;
  nextOpenLabel: string;
  nextOpenMs: number;
}

function getIST(): Date {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + 5.5 * 3600000);
}

function nextOpenTimestamp(targetHour: number, targetMin: number, extraDays: number): number {
  const now = getIST();
  const target = new Date(now);
  target.setHours(targetHour, targetMin, 0, 0);
  if (target <= now || extraDays > 0) target.setDate(target.getDate() + 1 + extraDays);
  return target.getTime();
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const NSE_OPEN_HOUR = 9;
const NSE_OPEN_MIN = 15;
const NSE_CLOSE_HOUR = 15;
const NSE_CLOSE_MIN = 30;

export function getMarketStatus(sector: string): MarketStatus {
  if (sector === "Crypto") {
    return { open: true, nextOpenLabel: "", nextOpenMs: 0 };
  }

  const now = getIST();
  const day = now.getDay();

  // Saturday → Monday 9:15 AM (skip Sunday)
  if (day === 6) {
    const nextOpenMs = nextOpenTimestamp(NSE_OPEN_HOUR, NSE_OPEN_MIN, 1);
    return { open: false, nextOpenLabel: formatDuration(nextOpenMs - now.getTime()), nextOpenMs };
  }

  // Sunday → Monday 9:15 AM
  if (day === 0) {
    const nextOpenMs = nextOpenTimestamp(NSE_OPEN_HOUR, NSE_OPEN_MIN, 0);
    return { open: false, nextOpenLabel: formatDuration(nextOpenMs - now.getTime()), nextOpenMs };
  }

  const totalMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = NSE_OPEN_HOUR * 60 + NSE_OPEN_MIN;
  const closeMinutes = NSE_CLOSE_HOUR * 60 + NSE_CLOSE_MIN;

  // Before market opens → today at 9:15 AM
  if (totalMinutes < openMinutes) {
    const nextOpenMs = nextOpenTimestamp(NSE_OPEN_HOUR, NSE_OPEN_MIN, 0);
    return { open: false, nextOpenLabel: formatDuration(nextOpenMs - now.getTime()), nextOpenMs };
  }

  // After market closes → tomorrow at 9:15 AM
  if (totalMinutes >= closeMinutes) {
    const nextOpenMs = nextOpenTimestamp(NSE_OPEN_HOUR, NSE_OPEN_MIN, 0);
    return { open: false, nextOpenLabel: formatDuration(nextOpenMs - now.getTime()), nextOpenMs };
  }

  return { open: true, nextOpenLabel: "", nextOpenMs: 0 };
}
