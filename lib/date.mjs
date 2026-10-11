export function formatDate(date) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("zh-CN", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
