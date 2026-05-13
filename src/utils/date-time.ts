export const APP_TIME_ZONE = "America/Sao_Paulo";

const DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const HOUR_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  hourCycle: "h23",
});

export function toLocalDateKey(date: Date = new Date()) {
  return DATE_KEY_FORMATTER.format(date);
}

export function formatLocalTime(isoString: string) {
  return TIME_FORMATTER.format(new Date(isoString));
}

export function getLocalHour(isoString: string) {
  return Number(HOUR_FORMATTER.format(new Date(isoString)));
}

export function getLocalDay(isoString: string) {
  return new Date(`${toLocalDateKey(new Date(isoString))}T12:00:00`).getDay();
}

export function getLocalTimeMinutes(isoString: string) {
  const [hours, minutes] = formatLocalTime(isoString).split(":").map(Number);
  return hours * 60 + minutes;
}

export function localDateTimeToIso(dateKey: string, time: string) {
  return new Date(`${dateKey}T${time}:00`).toISOString();
}

export function getLocalDayRange(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export function getLocalInclusiveDayRange(dateKey: string) {
  const { startIso, endIso } = getLocalDayRange(dateKey);
  return {
    startIso,
    endIso: new Date(new Date(endIso).getTime() - 1).toISOString(),
  };
}

export function getLocalMonthRange(date: Date = new Date()) {
  const [year, month] = toLocalDateKey(date).split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}
