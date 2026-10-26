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
| `waterEveryDays` | 1-60, required | Summer interval for a medium plant in open ground; the form scales it by plant size and, in a pot, by pot size (src/lib/watering.ts). |
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

A seasonal step that moves the plant says so with `moves`, and marking it done asks
where the plant is now:

| `moves` | | |
|---|---|---|
| `"in"` | Goes under cover for the winter (indoors, greenhouse, out of the rain). | Asks the zone, with "Al coperto" on; remembers where it was. |
| `"out"` | Comes back out. | Asks the zone, with the one it stood in before going in already picked. |
| `"repot"` | May end in a bigger pot. | Asks whether it was repotted; if so, opens Rinvasa o sposta. |

```json
{ "type": "other", "title": "Portare in casa", "months": [10], "only": { "potted": true }, "moves": "in" }
```
