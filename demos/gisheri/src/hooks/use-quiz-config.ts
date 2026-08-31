import { useQuery } from '@tanstack/react-query';
import { quizApi } from '@/lib/quiz-api';

export const useQuizConfig = () =>
  useQuery({
    queryKey: ['quiz-config'],
    queryFn: quizApi.get,
    staleTime: 5 * 60 * 1000,
  });
