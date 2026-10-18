import type { APIRoute, GetStaticPaths } from "astro";
import { EXAMPLES, exampleBySlug } from "../../examples";

export const getStaticPaths: GetStaticPaths = () => EXAMPLES.map((e) => ({ params: { slug: e.slug } }));

export const GET: APIRoute = ({ params }) => {
  const example = exampleBySlug(String(params.slug));
  return new Response(JSON.stringify(example?.record, null, 2) + "\n", {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
