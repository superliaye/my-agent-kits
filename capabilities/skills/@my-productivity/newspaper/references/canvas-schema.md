# Canvas schema

`canvas.json` is the complete version 1 document. `regions`, `nodes`, and `edges` are objects keyed
by stable IDs. The service owns `revision`; a filesystem author leaves it at the last accepted value.

```json
{
  "version": 1,
  "revision": 0,
  "title": "Build session",
  "focus": ["lead"],
  "regions": {
    "main": { "layout": "newspaper", "origin": [0, 0], "width": 1200, "columns": 4 }
  },
  "nodes": {
    "lead": {
      "type": "story", "region": "main", "order": 10, "span": 2,
      "title": "Work begins", "body": "The live brief is ready.", "status": "active"
    }
  },
  "edges": {}
}
```

Every node has `type`, `region`, `order`, and `span`. `span` is a positive integer no larger than
the region's column count. An optional `parent` names an existing region or node. A browser drag or
resize adds `frame: { x, y, width, height }`, which overrides recipe placement until removed.

Supported node-specific fields:

- `story`: `title` and `body` containing safe GitHub-Flavored Markdown. Headings, tables, task
  lists, blockquotes, fenced code, emphasis, and links are rendered; raw HTML is ignored.
- `code`: `title`, `code`, and optional `language`.
- `table`: `title`, string `headers`, and string `rows` of the same width.
- `metric`: `label`, string or numeric `value`, and optional `trend`.
- `callout`: `title`, GitHub-Flavored Markdown `body`, and optional `status` (`info`, `active`,
  `warning`, `risk`, `success`).
- `media`: `title`, run-relative `src`, `caption`, and optional `alt`. The file must remain beneath
  the run directory and be explicitly referenced by this node.

An edge is `{ "source": "node-id", "target": "node-id", "label": "optional" }`. Both endpoints
must exist. `focus` is an array of node or region IDs. Regions use `layout: "newspaper"`,
`origin: [x, y]`, positive `width`, and `columns` from 1 through 12.

Documents are limited to 5 MiB and 1,000 nodes. Arbitrary HTML is rejected. A missing region,
focus target, edge endpoint, media file, or path that escapes the run directory is invalid. Version
1 is a closed schema: fields not listed above are rejected instead of being treated as aliases.
