import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '@/lib/catalog-api';

const STALE_TIME = 5 * 60 * 1000; // 5 minutes — catalog rarely changes

export const useProducts = () =>
  useQuery({
    queryKey: ['products'],
    queryFn: catalogApi.listProducts,
    staleTime: STALE_TIME,
  });

export const useProduct = (id: string | number | undefined) =>
  useQuery({
    queryKey: ['product', id],
    queryFn: () => catalogApi.getProduct(id!),
    enabled: id !== undefined && id !== '',
    staleTime: STALE_TIME,
  });

export const useCollections = () =>
  useQuery({
    queryKey: ['collections'],
    queryFn: catalogApi.listCollections,
    staleTime: STALE_TIME,
  });

export const useZodiacInfo = () =>
  useQuery({
    queryKey: ['zodiac'],
    queryFn: catalogApi.listZodiac,
    staleTime: STALE_TIME,
  });
