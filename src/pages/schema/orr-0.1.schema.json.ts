import type { APIRoute } from "astro";
import schema from "../../schema/orr-0.1.schema.json";

export const GET: APIRoute = () =>
  new Response(JSON.stringify(schema, null, 2) + "\n", {
    headers: { "Content-Type": "application/schema+json; charset=utf-8" },
  });
