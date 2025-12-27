# API Reference

## Supabase Client

### Initialization

```typescript
import { supabase } from '@/lib/supabase';
```

### Authentication

```typescript
// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
});

// Sign out
await supabase.auth.signOut();

// Get current user
const { data: { user } } = await supabase.auth.getUser();

// Get session
const { data: { session } } = await supabase.auth.getSession();

// Listen to auth changes
supabase.auth.onAuthStateChange((event, session) => {
  console.log(event, session);
});
```

### Database Operations

```typescript
// Select all
const { data, error } = await supabase
  .from('posts')
  .select('*');

// Select with filter
const { data, error } = await supabase
  .from('posts')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(10);

// Select with relations
const { data, error } = await supabase
  .from('posts')
  .select(`
    *,
    user:users(id, name, avatar_url),
    comments(id, content)
  `);

// Insert
const { data, error } = await supabase
  .from('posts')
  .insert({ title: 'Hello', content: 'World' })
  .select()
  .single();

// Update
const { data, error } = await supabase
  .from('posts')
  .update({ title: 'Updated' })
  .eq('id', postId)
  .select()
  .single();

// Delete
const { error } = await supabase
  .from('posts')
  .delete()
  .eq('id', postId);

// Upsert
const { data, error } = await supabase
  .from('posts')
  .upsert({ id: postId, title: 'Upserted' })
  .select()
  .single();
```

### Storage

```typescript
// Upload file
const { data, error } = await supabase.storage
  .from('avatars')
  .upload(`${userId}/avatar.jpg`, file, {
    cacheControl: '3600',
    upsert: true,
  });

// Get public URL
const { data } = supabase.storage
  .from('avatars')
  .getPublicUrl(`${userId}/avatar.jpg`);

// Download file
const { data, error } = await supabase.storage
  .from('avatars')
  .download(`${userId}/avatar.jpg`);

// Delete file
const { error } = await supabase.storage
  .from('avatars')
  .remove([`${userId}/avatar.jpg`]);

// List files
const { data, error } = await supabase.storage
  .from('avatars')
  .list(userId);
```

### Edge Functions

```typescript
// Invoke function
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { key: 'value' },
});

// With custom headers
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { key: 'value' },
  headers: { 'x-custom-header': 'value' },
});
```

### Realtime

```typescript
// Subscribe to changes
const channel = supabase
  .channel('posts')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'posts' },
    (payload) => {
      console.log('Change:', payload);
    }
  )
  .subscribe();

// Subscribe to specific events
const channel = supabase
  .channel('posts')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'posts' },
    handleInsert
  )
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'posts' },
    handleUpdate
  )
  .subscribe();

// Unsubscribe
await supabase.removeChannel(channel);
```

---

## React Query Hooks

### Query Patterns

```typescript
// Basic query
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['posts'],
  queryFn: fetchPosts,
});

// Query with params
const { data } = useQuery({
  queryKey: ['post', postId],
  queryFn: () => fetchPost(postId),
  enabled: !!postId,
});

// Infinite query
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useInfiniteQuery({
  queryKey: ['posts'],
  queryFn: ({ pageParam = 0 }) => fetchPosts(pageParam),
  getNextPageParam: (lastPage) => lastPage.nextCursor,
});
```

### Mutation Patterns

```typescript
// Basic mutation
const { mutate, isPending } = useMutation({
  mutationFn: createPost,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['posts'] });
  },
});

// Optimistic update
const { mutate } = useMutation({
  mutationFn: updatePost,
  onMutate: async (newPost) => {
    await queryClient.cancelQueries({ queryKey: ['posts'] });
    const previous = queryClient.getQueryData(['posts']);
    queryClient.setQueryData(['posts'], (old) => 
      old.map((p) => p.id === newPost.id ? { ...p, ...newPost } : p)
    );
    return { previous };
  },
  onError: (err, newPost, context) => {
    queryClient.setQueryData(['posts'], context.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['posts'] });
  },
});
```

---

## Zustand Stores

### Store Pattern

```typescript
import { create } from 'zustand';

interface StoreState {
  // State
  count: number;
  user: User | null;
  
  // Actions
  increment: () => void;
  setUser: (user: User | null) => void;
  reset: () => void;
}

export const useStore = create<StoreState>((set) => ({
  count: 0,
  user: null,
  
  increment: () => set((state) => ({ count: state.count + 1 })),
  setUser: (user) => set({ user }),
  reset: () => set({ count: 0, user: null }),
}));
```

### With Persistence

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useSettingsStore = create(
  persist<SettingsState>(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

---

## Edge Function Response Helpers

```typescript
// supabase/functions/_shared/response.ts

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const json = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

export const error = (message: string, code: string, status = 400) =>
  json({ error: message, code }, status);

export const success = <T>(data: T) => json({ data });

// Usage in functions
return success({ user });
return error('Not found', 'NOT_FOUND', 404);
return error('Unauthorized', 'UNAUTHORIZED', 401);
return error('Server error', 'INTERNAL_ERROR', 500);
```

---

## Type Definitions

```typescript
// src/types/database.ts
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  title: string;
  content: string | null;
  created_at: string;
  updated_at: string;
}

// With relations
export interface PostWithUser extends Post {
  user: User;
}

// Input types
export interface CreatePostInput {
  title: string;
  content?: string;
}

export interface UpdatePostInput {
  title?: string;
  content?: string;
}
```

---

## Utility Functions

```typescript
// src/utils/format.ts
export const formatDate = (date: string | Date) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
};

export const formatRelativeTime = (date: string | Date) => {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'today';
  if (days < 7) return rtf.format(-days, 'day');
  if (days < 30) return rtf.format(-Math.floor(days / 7), 'week');
  return formatDate(date);
};

// src/utils/validation.ts
export const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const isValidPassword = (password: string) =>
  password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
```
