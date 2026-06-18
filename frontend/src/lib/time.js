// Haiti timezone helpers
// All "today" computations across the app should use Haiti time (America/Port-au-Prince, UTC-5, no DST)
const HAITI_TZ = "America/Port-au-Prince";

export const todayHaiti = () => {
  // "sv-SE" locale formats as YYYY-MM-DD
  return new Date().toLocaleDateString("sv-SE", { timeZone: HAITI_TZ });
};

export const monthHaiti = () => {
  return todayHaiti().slice(0, 7);
};

export const nowHaitiISO = () => {
  // Returns ISO-like timestamp anchored on Haiti TZ
  const d = new Date();
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: HAITI_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
};

export const formatDateTimeHaiti = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      timeZone: HAITI_TZ,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
};
