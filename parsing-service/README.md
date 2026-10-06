# parsing-service

News collector for Tennis Wire. Takes what is new at the sources in `sources.yaml`: the feed,
then the article page, and from it the text in markdown, metadata and embedded posts.

The design, the source list and the rules for adding a source are in
[architecture/aggregator.md](../architecture/aggregator.md). Running it locally is in
[docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md#parsing-service).

Until the aggregator exists (part 2) results go to local files under `OUTPUT_DIR`:

- `items-<date>.jsonl` — one news item per line;
- `changes.jsonl` — seen articles whose title or date changed in the feed;
- `runs.jsonl` — one report per run of a source;
- `html/<source>/<digest>.html.gz` — the pages the text was taken from.
