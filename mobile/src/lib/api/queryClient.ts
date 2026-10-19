import { QueryClient } from '@tanstack/react-query';

const MINUTE = 60_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: MINUTE,
      gcTime: 24 * 60 * MINUTE,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
