import { formatYYYYMMDD } from "./insights/utils";

export function getSystemDate(): string {
  return formatYYYYMMDD(new Date());
}

export function getSystemTime(): string {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}
