/** Query hooks for the event-content group (items, trivia, prizes). */
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { bus } from '@/demo/events'
import { http } from '@/lib/api'
import type { EventSummary, Item, ItemType, Prize, TriviaQuestion } from '@/types'

/** Form default points per type (the source's TYPE_DEFAULT_POINTS). */
export const TYPE_DEFAULT_POINTS: Record<ItemType, number> = { GOOD: 10, MINOR: -10, MAJOR: -500 }
export const ITEM_TYPES: ItemType[] = ['GOOD', 'MINOR', 'MAJOR']

export type ItemInput = Pick<Item, 'name' | 'type' | 'points' | 'brandName' | 'imageUrl' | 'weight' | 'active'>
export type TriviaInput = Pick<TriviaQuestion, 'question' | 'options' | 'correctIndex' | 'points' | 'seconds' | 'active'>
export type PrizeInput = Pick<Prize, 'label' | 'description' | 'imageUrl' | 'sortOrder'>

/** Everything a content write can change: this group, the events list and counts, the game config and the player hub. */
export function invalidateContent(client: QueryClient): void {
  for (const key of [queryKeys.content.all, queryKeys.events.all, queryKeys.play.all, queryKeys.hub.all]) {
    void client.invalidateQueries({ queryKey: key })
  }
}

/** Keep the screen in step with writes made elsewhere (another group's event delete, a demo reset). */
export function useContentSync(): void {
  const client = useQueryClient()
  useEffect(() => {
    const refresh = () => void client.invalidateQueries({ queryKey: queryKeys.content.all })
    const offChanged = bus.on('event:changed', refresh)
    const offReset = bus.on('demo:reset', refresh)
    return () => {
      offChanged()
      offReset()
    }
  }, [client])
}

export function useEventSummary(eventId: string) {
  return useQuery({
    queryKey: queryKeys.events.detail(eventId),
    queryFn: () => http.get<EventSummary>(`/admin/events/${eventId}`),
    retry: false,
  })
}

export const useItems = (eventId: string) =>
  useQuery({ queryKey: queryKeys.content.items(eventId), queryFn: () => http.get<Item[]>(`/admin/events/${eventId}/items`) })

export const useTrivia = (eventId: string) =>
  useQuery({
    queryKey: queryKeys.content.trivia(eventId),
    queryFn: () => http.get<TriviaQuestion[]>(`/admin/events/${eventId}/trivia`),
  })

export const usePrizes = (eventId: string) =>
  useQuery({ queryKey: queryKeys.content.prizes(eventId), queryFn: () => http.get<Prize[]>(`/admin/events/${eventId}/prizes`) })

/** Create-or-update and delete for one collection. `id` null = create. */
function useCrud<TInput, TRow>(collection: 'items' | 'trivia' | 'prizes', eventId: string) {
  const client = useQueryClient()
  const onSuccess = () => invalidateContent(client)
  const save = useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: TInput }) =>
      id
        ? http.patch<TRow>(`/admin/${collection}/${id}`, input)
        : http.post<TRow>(`/admin/events/${eventId}/${collection}`, input),
    onSuccess,
  })
  const remove = useMutation({
    mutationFn: (id: string) => http.del<{ ok: true }>(`/admin/${collection}/${id}`),
    onSuccess,
  })
  return { save, remove }
}

export const useItemCrud = (eventId: string) => useCrud<Partial<ItemInput>, Item>('items', eventId)
export const useTriviaCrud = (eventId: string) => useCrud<Partial<TriviaInput>, TriviaQuestion>('trivia', eventId)
export const usePrizeCrud = (eventId: string) => useCrud<Partial<PrizeInput>, Prize>('prizes', eventId)

/**
 * Image upload without a network: a real image file becomes an object URL
 * that lives for this tab; anything else asks the mock for the next placeholder.
 */
export async function uploadImage(file: File | null): Promise<string> {
  if (file && file.size > 0 && file.type.startsWith('image/') && typeof URL.createObjectURL === 'function') {
    try {
      return URL.createObjectURL(file)
    } catch {
      /* fall through to the placeholder */
    }
  }
  const { url } = await http.post<{ url: string }>('/admin/uploads', { fileName: file?.name ?? 'image' })
  return url
}
