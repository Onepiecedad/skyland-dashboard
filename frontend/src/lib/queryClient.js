import { QueryClient, QueryClientProvider as Provider } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30 * 1000,
            retry: 1,
            refetchOnWindowFocus: true,
        },
    },
});

export const QueryClientProvider = Provider;
