# Adding plants to the catalog from a file

Impostazioni › Catalogo › **Aggiungi piante da file** reads a JSON file and adds its
plants to the catalog, on top of the built-in ones. Nothing is deleted: a plant with
the name of one added earlier replaces it, a plant with the name of a built-in one is
refused. Added plants go in the backup. Example: [catalogo/mimosa-tardiva.json](catalogo/mimosa-tardiva.json).

```json
{
  "app": "ortdirector",
  "catalog": [ { "name": "Feijoa", "sun": "full", "waterEveryDays": 5 } ]
}
```

Any text can be plain Italian, or `{ "it": "…", "en": "…" }` to give the English too.

| Field | | |
|---|---|---|
| `name` | text, required | Catalog name, the key saved with the plant. |
| `sun` | required | `"full"`, `"partial"` or `"shade"`. |
| `waterEveryDays` | 1-60, required | Summer interval in open ground (pots dry out faster: adjust in the form). |
| `waterColdDays` | 1-90 | Rest of the year; default a third as often, at most every 21 days. |
| `tip` | text | Shown in the form when the plant is picked. |
| `annual` | true/false | Lives one season; default false. |
| `tender` | true/false | Fears frost: seasonal steps with `"only": { "tender": true }` apply. |
| `aliases` | list of strings | Other names the search finds it by. |
| `sowToTransplantWeeks` | `[min, max]` | For plants started from seed: the "ready to transplant" reminder. |
| `steps` | list | Care counted from the day it goes into its final spot. |
| `seasonal` | list | Care that follows the calendar. |

A step: `type` (`water`, `check`, `prune`, `fertilize`, `treat`, `harvest`, `other`),
`title`, `day` (days after planting), optional `every` (repeat every N days),
`until` (last day for repeats), `months` (1-12, the months it may fall in).

A seasonal step: `type`, `title`, `months` (required), optional `every` (repeat every
N days within the months; without it, once a year) and `only`, e.g.
`{ "potted": true }` for pots only, `{ "potted": false }` for the ground only,
`{ "tender": true }`.
