import type { APIRoute, GetStaticPaths } from "astro";
import { getEvents, type EventView } from "../../lib/events";
import { icsFile } from "../../lib/ics";

// One .ics file per event for the "In meinen Kalender" buttons.

export const getStaticPaths = (async () => {
  const events = await getEvents();
  return events.map((event) => ({ params: { id: event.id }, props: { event } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props, site }) => icsFile([props.event as EventView], site);
