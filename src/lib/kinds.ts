// Kinds of plant, for plants that aren't in the catalog: the user picks what
// the plant is (a fruit tree, a shrub, a succulent), whether it's potted, how
// big it is and whether it fears frost, and the kind's plan in plans.ts gives
// its care. Pure logic, no React Native imports, so it runs under `node --test`.
import type { PlantPreset } from './presets';

export interface PlantKind extends PlantPreset {
  /** Watering interval the rest of the year, when a third as often as in summer is too much. */
  waterColdDays?: number;
  /** Usually can't stand frost: the form starts with "teme il gelo" on. */
  tender: boolean;
  annual?: boolean;
}

/** How big the plant is now. */
export type Size = 'small' | 'medium' | 'large';

// The name is the key saved as the plant's preset, as for catalog plants.
// `waterEveryDays` is for a medium plant in open ground, in summer.
export const PLANT_KINDS: PlantKind[] = [
  { name: 'Albero da frutto', sun: 'full', waterEveryDays: 7, tender: false, tip: 'Pota d’inverno a gemme ferme. Annaffia a fondo e di rado: le radici devono andare in profondità.' },
  { name: 'Albero da frutto tropicale', sun: 'full', waterEveryDays: 4, tender: true, tip: 'Teme il gelo: in vaso va al riparo d’inverno, in terra copri la chioma e pacciama le radici. Concima poco e spesso da marzo a settembre.' },
  { name: 'Agrume', sun: 'full', waterEveryDays: 4, tender: true, tip: 'Lascia asciugare i primi cm di terra tra un’annaffiatura e l’altra. Concime per agrumi da marzo a settembre. Sotto i -3 °C va protetto.' },
  { name: 'Albero ornamentale', sun: 'full', waterEveryDays: 10, tender: false, tip: 'I primi due anni annaffia con regolarità; poi in terra basta la pioggia, tranne nelle estati più secche.' },
  { name: 'Arbusto', sun: 'full', waterEveryDays: 5, tender: false, tip: 'Se fiorisce in primavera, potalo subito dopo la fioritura invece che a fine inverno.' },
  { name: 'Siepe', sun: 'full', waterEveryDays: 7, tender: false, tip: 'Tosala due volte l’anno, a inizio estate e a fine estate. Più stretta in alto che in basso, così la luce arriva alla base.' },
  { name: 'Rampicante', sun: 'full', waterEveryDays: 4, tender: false, tip: 'Lega i tralci nuovi al sostegno mentre sono ancora flessibili.' },
  { name: 'Perenne da fiore', sun: 'full', waterEveryDays: 4, tender: false, tip: 'Togli i fiori secchi per farla rifiorire. A fine inverno taglia gli steli secchi.' },
  { name: 'Annuale da fiore', sun: 'full', waterEveryDays: 2, tender: false, annual: true, tip: 'Togli i fiori secchi ogni settimana e concima spesso: fiorisce fino ai primi freddi.' },
  { name: 'Succulenta o cactus', sun: 'full', waterEveryDays: 14, waterColdDays: 30, tender: true, tip: 'Annaffia solo con il terriccio asciutto, quasi mai d’inverno. Teme più l’umidità del freddo.' },
];

export function kindFor(preset: string | null | undefined): PlantKind | undefined {
  return PLANT_KINDS.find((k) => k.name === preset);
}

// Pots dry out faster than open ground; a young plant has few roots, a big
// established one reaches water deep down.
const WATER_FACTOR: Record<'ground' | 'pot', Record<Size, number>> = {
  ground: { small: 0.5, medium: 1, large: 1.5 },
  pot: { small: 0.35, medium: 0.5, large: 0.75 },
};

/** Summer watering interval for a plant of this kind, in a pot or not, of this size. */
export function kindWatering(kind: PlantKind, potted: boolean, size: Size): number {
  const days = Math.round(kind.waterEveryDays * WATER_FACTOR[potted ? 'pot' : 'ground'][size]);
  return Math.min(Math.max(days, 1), 60);
}
