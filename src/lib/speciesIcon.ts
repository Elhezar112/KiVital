import { SPECIES_CONFIG, type SpeciesKey } from './breeds'

export function speciesIcon(species: string): string {
  return SPECIES_CONFIG[species as SpeciesKey]?.icon ?? '🐾'
}

export function speciesLabel(species: string): string {
  return SPECIES_CONFIG[species as SpeciesKey]?.label ?? species
}
