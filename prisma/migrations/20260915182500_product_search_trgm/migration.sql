-- Typo-tolerant product search without a separate search engine.
--
-- pg_trgm scores similarity on three-character sequences, so "ultratec",
-- "ultra tech" and "ultratech" all reach the same product. A GIN index over the
-- denormalised searchText column keeps this fast to roughly 10k products, well
-- past the single-city pilot. Past that, revisit with Typesense or Meilisearch.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "products_search_text_trgm"
  ON "Product" USING gin ("searchText" gin_trgm_ops);

-- Supports prefix/ILIKE lookups on brand and category names in the same query.
CREATE INDEX IF NOT EXISTS "brand_name_trgm"
  ON "Brand" USING gin ("name" gin_trgm_ops);
