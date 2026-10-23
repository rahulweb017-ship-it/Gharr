import { z } from "zod";

/**
 * Boolean query-string flag.
 *
 * `z.coerce.boolean()` is the wrong tool here: it runs `Boolean("false")`, which
 * is `true`, so `?inStock=false` would switch the filter on. Only an explicit
 * "true" or "1" enables a flag; anything else (including absence) leaves it off.
 */
export const queryBool = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    if (v == null) return undefined;
    const value = Array.isArray(v) ? v[v.length - 1] : v;
    return value === "true" || value === "1";
  });
