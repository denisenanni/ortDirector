// Summer watering interval from the catalog's one, which is for a medium
// plant in open ground. In the ground a big plant reaches water deep down
// and a young one has few roots. In a pot what counts is the plant against
// its pot: a big plant in a small pot dries it out fast, a seedling in a
// big pot leaves it wet for days. Pure logic, so it runs under `node --test`.
import type { Size } from './types';

const GROUND: Record<Size, number> = { small: 0.5, medium: 1, large: 1.5 };

// By plant size, then pot size.
const POT: Record<Size, Record<Size, number>> = {
  small: { small: 0.5, medium: 0.7, large: 0.9 },
  medium: { small: 0.35, medium: 0.5, large: 0.7 },
  large: { small: 0.25, medium: 0.35, large: 0.5 },
};

/** Summer interval for this plant; sizes not given count as medium. */
export function scaledWatering(groundDays: number, potted: boolean, size: Size | null, potSize: Size | null): number {
  const factor = potted ? POT[size ?? 'medium'][potSize ?? 'medium'] : GROUND[size ?? 'medium'];
  return Math.min(Math.max(Math.round(groundDays * factor), 1), 60);
}
