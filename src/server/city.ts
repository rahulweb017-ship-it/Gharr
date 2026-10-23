import { cookies } from "next/headers";
import { env } from "@/server/env";

/**
 * The customer's chosen city, set on /location and stored in a plain cookie
 * (it is a preference, not a credential). Falls back to the launch city.
 */
export const CITY_COOKIE = "ha_city";

/** Cities Gharr actually serves today. Others are shown as "coming soon". */
export const LIVE_CITIES = ["Hyderabad"] as const;

export const POPULAR_CITIES = [
  "Hyderabad",
  "Bangalore",
  "Mumbai",
  "Delhi",
  "Chennai",
  "Pune",
] as const;

export async function getSelectedCity(): Promise<string> {
  const store = await cookies();
  const value = store.get(CITY_COOKIE)?.value;
  return value && value.length <= 60 ? value : env.DEFAULT_CITY;
}

export function isLiveCity(city: string): boolean {
  return (LIVE_CITIES as readonly string[]).includes(city);
}
