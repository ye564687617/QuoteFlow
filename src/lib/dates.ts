const TIME_ZONE = "Asia/Shanghai";

export function shanghaiDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  return {
    iso: `${year}-${month}-${day}`,
    compact: `${year}${month}${day}`,
    databaseDate: new Date(`${year}-${month}-${day}T00:00:00.000Z`),
  };
}

export function formatCompactDate(date: Date | string) {
  const value = typeof date === "string" ? date.slice(0, 10) : date.toISOString().slice(0, 10);
  return value.replaceAll("-", "");
}
