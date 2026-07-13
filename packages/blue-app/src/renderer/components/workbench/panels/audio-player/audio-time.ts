export function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00.000";

  const totalMilliseconds = Math.round(seconds * 1000);
  const minutes = Math.floor(totalMilliseconds / 60_000);
  const secondsWithinMinute = Math.floor((totalMilliseconds % 60_000) / 1000);
  const milliseconds = totalMilliseconds % 1000;

  return `${String(minutes).padStart(2, "0")}:${String(secondsWithinMinute).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}
