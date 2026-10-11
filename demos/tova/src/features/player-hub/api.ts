/** Player-hub query hooks: My card, trivia and prizes, kept live through the demo bus. */
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuthUserId } from '@/demo/auth'
import { bus } from '@/demo/events'
import { http } from '@/lib/api'
import type { MyCard, PrizesResponse, TriviaAnswerResult, TriviaState } from '@/types'

export const hubKeys = {
  all: ['hub'] as const,
  card: (userId: string | null) => ['hub', 'card', userId ?? 'anon'] as const,
  trivia: (userId: string | null) => ['hub', 'trivia', userId ?? 'anon'] as const,
  prizes: (userId: string | null) => ['hub', 'prizes', userId ?? 'anon'] as const,
}

export function useMyCard() {
  const userId = useAuthUserId()
  return useQuery({
    queryKey: hubKeys.card(userId),
    queryFn: () => http.get<MyCard>('/me/card'),
    enabled: !!userId,
  })
}

export function useTriviaState() {
  const userId = useAuthUserId()
  return useQuery({
    queryKey: hubKeys.trivia(userId),
    queryFn: () => http.get<TriviaState>('/trivia/state'),
    enabled: !!userId,
  })
}

export function usePrizes() {
  const userId = useAuthUserId()
  return useQuery({
    queryKey: hubKeys.prizes(userId),
    queryFn: () => http.get<PrizesResponse>('/prizes'),
  })
}

export function useAnswerTrivia() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()
  return useMutation({
    mutationFn: (input: { questionId: string; selectedIndex: number }) =>
      http.post<TriviaAnswerResult>('/trivia/answer', input),
    onSuccess: (result, input) => {
      // Drop the answered question at once so the count never lags the result.
      queryClient.setQueryData<TriviaState>(hubKeys.trivia(userId), (prev) =>
        prev
          ? {
              ...prev,
              answeredCount: prev.answeredCount + 1,
              earnedPoints: prev.earnedPoints + result.pointsAwarded,
              remaining: prev.remaining.filter((question) => question.id !== input.questionId),
            }
          : prev,
      )
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: hubKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['standings'] })
    },
  })
}

/**
 * Keeps hub screens in step with everything else in the demo: your own new
 * round, trivia answered in another screen, admin edits and a demo reset.
 */
export function useHubLiveSync() {
  const queryClient = useQueryClient()
  const userId = useAuthUserId()
  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: hubKeys.all })
    const offs = [
      bus.on('play:created', (payload) => {
        if (payload.userId === userId) refresh()
      }),
      bus.on('trivia:answered', (payload) => {
        if (payload.userId === userId) refresh()
      }),
      bus.on('event:changed', refresh),
      bus.on('demo:reset', refresh),
    ]
    return () => offs.forEach((off) => off())
  }, [queryClient, userId])
}
