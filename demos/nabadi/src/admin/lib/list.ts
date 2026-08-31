/** DRF returns either a bare array or {count, next, previous, results} for lists.
 *  This unwraps both shapes into a plain array. */
export function unwrap<T>(data: T[] | { results: T[] } | undefined | null): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

export type ListOrPaginated<T> =
  | T[]
  | { count: number; next: string | null; previous: string | null; results: T[] };
