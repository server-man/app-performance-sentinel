# Mobile Optimization Guide

## Performance Principles

Mobile apps face unique challenges:
- Unreliable networks
- Limited CPU/memory
- Cold start latency (app + edge)
- Battery constraints

---

## 1. Optimistic UI Pattern

Never make users wait for network requests.

### Example: Like Button

```typescript
// src/hooks/mutations/useLikePost.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';

export const useLikePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase
        .from('likes')
        .insert({ post_id: postId });
      if (error) throw error;
    },

    onMutate: async (postId) => {
      // Haptic feedback immediately
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['posts'] });

      // Snapshot previous value
      const previousPosts = queryClient.getQueryData(['posts']);

      // Optimistically update
      queryClient.setQueryData(['posts'], (old: any[]) =>
        old.map((post) =>
          post.id === postId
            ? { ...post, likes: post.likes + 1, isLiked: true }
            : post
        )
      );

      return { previousPosts };
    },

    onError: (err, postId, context) => {
      // Rollback on error
      queryClient.setQueryData(['posts'], context?.previousPosts);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },

    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
};
```

---

## 2. Session Restore Flow

App cold start should feel instant.

```typescript
// src/hooks/stores/useAuthStore.ts
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    try {
      // 1. Check cached session first (instant)
      const cachedUser = await AsyncStorage.getItem('cached_user');
      if (cachedUser) {
        set({ user: JSON.parse(cachedUser), isLoading: false });
      }

      // 2. Validate session in background
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Update with fresh data
        set({ user: session.user });
        await AsyncStorage.setItem('cached_user', JSON.stringify(session.user));
      } else {
        // Session invalid, clear cache
        set({ user: null });
        await AsyncStorage.removeItem('cached_user');
      }
    } catch (error) {
      console.error('Auth init error:', error);
    } finally {
      set({ isLoading: false, isInitialized: true });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    await AsyncStorage.removeItem('cached_user');
    set({ user: null });
  },
}));
```

### Usage in Root Layout

```typescript
// app/_layout.tsx
import { useEffect } from 'react';
import { useAuthStore } from '@/hooks/stores/useAuthStore';
import { SplashScreen } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isInitialized, initialize } = useAuthStore();

  useEffect(() => {
    initialize().finally(() => {
      SplashScreen.hideAsync();
    });
  }, []);

  if (!isInitialized) {
    return null; // Splash screen still visible
  }

  return <Stack />;
}
```

---

## 3. Network Resilience

### Offline-First Query Hook

```typescript
// src/hooks/queries/useOfflineQuery.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

export function useOfflineQuery<T>(
  key: string[],
  fetcher: () => Promise<T>,
  options?: { staleTime?: number }
) {
  const queryClient = useQueryClient();
  const cacheKey = `offline_${key.join('_')}`;

  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const netInfo = await NetInfo.fetch();

      if (!netInfo.isConnected) {
        // Offline: return cached data
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) return JSON.parse(cached) as T;
        throw new Error('No network and no cached data');
      }

      // Online: fetch and cache
      const data = await fetcher();
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      return data;
    },
    staleTime: options?.staleTime ?? 1000 * 60 * 5,
    networkMode: 'offlineFirst',
  });
}
```

### Offline Mutation Queue

```typescript
// src/lib/offline-queue.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

interface QueuedMutation {
  id: string;
  fn: string;
  args: any;
  timestamp: number;
}

const QUEUE_KEY = 'offline_mutation_queue';

export const offlineQueue = {
  async add(fn: string, args: any) {
    const queue = await this.getQueue();
    queue.push({
      id: crypto.randomUUID(),
      fn,
      args,
      timestamp: Date.now(),
    });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  },

  async getQueue(): Promise<QueuedMutation[]> {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  },

  async processQueue(handlers: Record<string, (args: any) => Promise<void>>) {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) return;

    const queue = await this.getQueue();
    const remaining: QueuedMutation[] = [];

    for (const item of queue) {
      try {
        await handlers[item.fn](item.args);
      } catch (error) {
        remaining.push(item);
      }
    }

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  },
};
```

---

## 4. Image Optimization

### Lazy Loading with Placeholder

```typescript
// src/components/ui/OptimizedImage.tsx
import { useState } from 'react';
import { Image, View, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

interface Props {
  uri: string;
  width: number;
  height: number;
  blurhash?: string;
}

export function OptimizedImage({ uri, width, height, blurhash }: Props) {
  const [loaded, setLoaded] = useState(false);

  return (
    <View style={{ width, height }}>
      {!loaded && (
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          style={[StyleSheet.absoluteFill, styles.placeholder]}
        />
      )}
      <Image
        source={{ uri }}
        style={{ width, height }}
        onLoad={() => setLoaded(true)}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#e0e0e0',
  },
});
```

### Supabase Image Transforms

```typescript
// src/utils/image.ts
export const getOptimizedImageUrl = (
  path: string,
  options: { width?: number; height?: number; quality?: number } = {}
) => {
  const { width = 400, height, quality = 80 } = options;
  
  const params = new URLSearchParams({
    width: width.toString(),
    quality: quality.toString(),
  });
  
  if (height) params.set('height', height.toString());

  return `${SUPABASE_URL}/storage/v1/render/image/public/${path}?${params}`;
};
```

---

## 5. List Virtualization

### FlashList for Large Lists

```typescript
// src/components/screens/FeedScreen.tsx
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';

export function FeedScreen() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam = 0 }) => fetchFeed(pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const posts = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <FlashList
      data={posts}
      renderItem={({ item }) => <PostCard post={item} />}
      estimatedItemSize={300}
      onEndReached={() => hasNextPage && fetchNextPage()}
      onEndReachedThreshold={0.5}
      ListFooterComponent={isFetchingNextPage ? <LoadingSpinner /> : null}
    />
  );
}
```

---

## 6. Haptic Feedback

Use haptics to make the app feel responsive even during network delays.

```typescript
// src/utils/haptics.ts
import * as Haptics from 'expo-haptics';

export const haptics = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  selection: () => Haptics.selectionAsync(),
};
```

---

## 7. Background Fetch Pattern

For heavy operations, don't block UI.

```typescript
// src/hooks/mutations/useGenerateContent.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const useGenerateContent = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (prompt: string) => api.generateContent(prompt),
    onSuccess: (data) => {
      // Start polling for result
      queryClient.setQueryData(['ai-job', data.jobId], { status: 'processing' });
    },
  });

  return mutation;
};

export const useAIJobStatus = (jobId: string | null) => {
  return useQuery({
    queryKey: ['ai-job', jobId],
    queryFn: () => api.getJobStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (data) => 
      data?.status === 'processing' ? 1000 : false,
  });
};
```

---

## Performance Checklist

- [ ] Optimistic updates on all mutations
- [ ] Session cached in AsyncStorage
- [ ] Offline queue for mutations
- [ ] Haptic feedback on interactions
- [ ] Virtualized lists (FlashList)
- [ ] Image optimization with transforms
- [ ] Background fetch for heavy operations
- [ ] Splash screen until auth initialized
- [ ] Network state awareness
- [ ] Proper error boundaries
