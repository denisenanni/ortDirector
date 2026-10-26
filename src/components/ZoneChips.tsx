import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { Chip, ChipRow } from '@/components/ui';
import { SUN_SYMBOL } from '@/components/Icon';
import { listZones } from '@/lib/db';
import { tr } from '@/lib/i18n';
import type { Zone } from '@/lib/types';

/**
 * The garden's zones, reloaded on focus to pick up one just created from
 * "New zone"; `onAdded` gets it, so the form can select it.
 */
export function useZones(onAdded: (id: number) => void): Zone[] {
  const db = useSQLiteContext();
  const [zones, setZones] = useState<Zone[]>([]);
  const known = useRef<Set<number> | null>(null);
  const added = useRef(onAdded);
  added.current = onAdded;
  useFocusEffect(
    useCallback(() => {
      listZones(db).then((list) => {
        const fresh = known.current && list.find((z) => !known.current!.has(z.id));
        known.current = new Set(list.map((z) => z.id));
        setZones(list);
        if (fresh) added.current(fresh.id);
      });
    }, [db]),
  );
  return zones;
}

/** Picks a zone, or none, with a chip to create a new one. */
export function ZoneChips({ zones, value, onChange }: { zones: Zone[]; value: number | null; onChange: (id: number | null) => void }) {
  return (
    <ChipRow>
      <Chip label={tr('Nessuna', 'None')} selected={value === null} onPress={() => onChange(null)} />
      {zones.map((z) => (
        <Chip key={z.id} icon={SUN_SYMBOL[z.sun]} label={z.name} selected={value === z.id} onPress={() => onChange(z.id)} />
      ))}
      <Chip icon="add" label={tr('Nuova zona', 'New zone')} onPress={() => router.push('/zone/edit')} />
    </ChipRow>
  );
}
