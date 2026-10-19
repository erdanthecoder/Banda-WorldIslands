// World Islands 2.0 goes live at 10:00 in Amman (UTC+3) on 10 October 2026 = 07:00 UTC.
// Before that, everything new in 2.0 stays hidden; players online at that moment see it arrive.
export const LAUNCH_2 = Date.parse('2026-10-10T07:00:00Z');
export const isV2 = () => Date.now() >= LAUNCH_2;
