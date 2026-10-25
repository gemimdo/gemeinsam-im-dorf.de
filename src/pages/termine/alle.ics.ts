import type { APIRoute } from "astro";
import { getEvents } from "../../lib/events";
import { icsFile } from "../../lib/ics";
import { site } from "../../site.config";

// Subscribable feed with the events of all category calendars ("Kalender abonnieren").
// Rebuilt with the site, so subscribers' calendar apps fetch it from us, not from Google.

export const GET: APIRoute = async ({ site: siteUrl }) =>
  icsFile(await getEvents(), siteUrl, `${site.clubName} ${site.legalForm}`);
