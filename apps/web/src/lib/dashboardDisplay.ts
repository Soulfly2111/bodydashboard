const heinerId = "cmr2ikkrx0000djmowa316dh5";
const wholeNumber = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

export function usesHeinerDashboard(userId: string | undefined) {
  return userId === heinerId;
}

export function formatDashboardInteger(value: number) {
  const rounded = Math.ceil(value);
  return wholeNumber.format(rounded === 0 ? 0 : rounded);
}
