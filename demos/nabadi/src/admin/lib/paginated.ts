import { useState } from 'react';
import { api } from './api';
import type { ListOrPaginated } from './list';

/** Mirrors backend REST_FRAMEWORK["PAGE_SIZE"] (core/settings/base.py). */
export const PAGE_SIZE = 25;

/** DRF PageNumberPagination envelope. */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/**
 * Normalizes a list response into the paginated envelope shape so pages can
 * consume one type whether the backend paginates the endpoint or not.
 */
export function toPaginated<T>(data: ListOrPaginated<T> | undefined | null): Paginated<T> {
  if (!data) return { count: 0, next: null, previous: null, results: [] };
  if (Array.isArray(data)) {
    return { count: data.length, next: null, previous: null, results: data };
  }
  return {
    count: data.count ?? data.results.length,
    next: data.next ?? null,
    previous: data.previous ?? null,
    results: data.results ?? [],
  };
}

export function pageCount(count: number, pageSize: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(count / pageSize));
}

/** Appends `page=N` to a path that may or may not already have a query string. */
export function withPage(path: string, page: number): string {
  if (page <= 1) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}page=${page}`;
}

// Safety valve so a backend bug (next never null) can't loop forever.
const MAX_PAGES = 40;

/**
 * Fetches EVERY page of a paginated endpoint and returns the concatenated
 * results. Use for lookup data that must be complete regardless of volume
 * (filter dropdowns, per-barber working hours, client-side-filtered lists).
 * Handles bare-array responses transparently.
 */
export async function fetchAllPages<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const data = toPaginated(await api.get<ListOrPaginated<T>>(withPage(path, page)));
    items.push(...data.results);
    if (data.next === null) break;
  }
  return items;
}

/**
 * Page state that snaps back to 1 whenever `resetKey` changes (e.g. the
 * serialized filters feeding the query). Render-time sync — no extra effect
 * pass — matching the tracked-state idiom used across the admin pages.
 */
export function usePageState(resetKey: string): [number, (page: number) => void] {
  const [page, setPage] = useState(1);
  const [tracked, setTracked] = useState(resetKey);
  if (tracked !== resetKey) {
    setTracked(resetKey);
    setPage(1);
  }
  return [page, setPage];
}
