# Development Guide

## Daily Workflow

### Starting Development

```bash
# Terminal 1: Start Expo
npx expo start

# Terminal 2: Start local Supabase
supabase start

# Terminal 3: Serve Edge Functions locally
supabase functions serve
```

### Running on Devices

```bash
# iOS Simulator
npx expo run:ios

# Android Emulator
npx expo run:android

# Physical device (scan QR code)
npx expo start
```

---

## Code Organization

### Component Guidelines

```
src/components/
├── ui/              # Primitive UI components
│   ├── Button.tsx
│   ├── Input.tsx
│   └── Text.tsx
├── forms/           # Form components
│   ├── LoginForm.tsx
│   └── ProfileForm.tsx
└── screens/         # Screen-level components
    ├── HomeScreen.tsx
    └── ProfileScreen.tsx
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `UserCard.tsx` |
| Hooks | camelCase, use- prefix | `useUserData.ts` |
| Utilities | camelCase | `formatDate.ts` |
| Types | PascalCase | `User.ts` |
| Constants | SCREAMING_SNAKE | `API_URL` |

---

## Creating Components

### UI Component Template

```typescript
// src/components/ui/Button.tsx
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { haptics } from '@/utils/haptics';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
}

export function Button({ 
  title, 
  onPress, 
  variant = 'primary',
  disabled = false,
  loading = false,
}: ButtonProps) {
  const handlePress = () => {
    haptics.light();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.text, styles[`${variant}Text`]]}>
        {loading ? 'Loading...' : title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: '#000',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#000',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryText: {
    color: '#fff',
  },
  secondaryText: {
    color: '#000',
  },
  ghostText: {
    color: '#000',
  },
});
```

---

## Creating Hooks

### Query Hook Template

```typescript
// src/hooks/queries/usePosts.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Post } from '@/types/Post';

export const usePosts = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['posts'],
    queryFn: async (): Promise<Post[]> => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: options?.enabled ?? true,
  });
};
```

### Mutation Hook Template

```typescript
// src/hooks/mutations/useCreatePost.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { haptics } from '@/utils/haptics';
import type { Post } from '@/types/Post';

interface CreatePostInput {
  title: string;
  content: string;
}

export const useCreatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePostInput): Promise<Post> => {
      const { data, error } = await supabase
        .from('posts')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    onMutate: async (newPost) => {
      haptics.light();
      await queryClient.cancelQueries({ queryKey: ['posts'] });
      
      const previousPosts = queryClient.getQueryData<Post[]>(['posts']);
      
      queryClient.setQueryData<Post[]>(['posts'], (old) => [
        { ...newPost, id: 'temp', created_at: new Date().toISOString() } as Post,
        ...(old ?? []),
      ]);

      return { previousPosts };
    },

    onError: (err, newPost, context) => {
      haptics.error();
      queryClient.setQueryData(['posts'], context?.previousPosts);
    },

    onSuccess: () => {
      haptics.success();
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
};
```

### Store Hook Template

```typescript
// src/hooks/stores/useAppStore.ts
import { create } from 'zustand';

interface AppState {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  
  bottomSheetOpen: boolean;
  openBottomSheet: () => void;
  closeBottomSheet: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'light',
  setTheme: (theme) => set({ theme }),
  
  bottomSheetOpen: false,
  openBottomSheet: () => set({ bottomSheetOpen: true }),
  closeBottomSheet: () => set({ bottomSheetOpen: false }),
}));
```

---

## Database Migrations

### Creating a Migration

```bash
# Create new migration
supabase migration new create_posts_table
```

### Migration File Template

```sql
-- supabase/migrations/20240101000000_create_posts_table.sql

-- Create table
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view all posts"
  ON posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create own posts"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
  ON posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
  ON posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX posts_user_id_idx ON posts(user_id);
CREATE INDEX posts_created_at_idx ON posts(created_at DESC);

-- Updated at trigger
CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Running Migrations

```bash
# Apply locally
supabase db reset

# Push to remote
supabase db push
```

---

## Edge Function Development

### Creating a Function

```bash
supabase functions new my-function
```

### Testing Locally

```bash
# Serve all functions
supabase functions serve

# Test with curl
curl -X POST http://localhost:54321/functions/v1/my-function \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"key": "value"}'
```

### Debugging

```typescript
// Add logging in your function
console.log('Request received:', JSON.stringify(body));
console.log('User:', user?.id);

// View logs
supabase functions logs my-function
```

---

## Testing

### Unit Tests

```typescript
// src/__tests__/utils/formatDate.test.ts
import { formatDate } from '@/utils/formatDate';

describe('formatDate', () => {
  it('formats date correctly', () => {
    const date = new Date('2024-01-15');
    expect(formatDate(date)).toBe('Jan 15, 2024');
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

---

## Debugging

### React Native Debugger

1. Shake device or Cmd+D (iOS) / Cmd+M (Android)
2. Select "Debug with Chrome"

### Flipper (Recommended)

1. Install Flipper: https://fbflipper.com/
2. Run app in debug mode
3. Connect via Flipper

### Console Logs

```typescript
// Use __DEV__ for development-only logs
if (__DEV__) {
  console.log('Debug info:', data);
}
```

---

## Deployment

### Building for Production

```bash
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production
```

### Deploying Edge Functions

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy my-function

# Set secrets
supabase secrets set MY_SECRET=value
```

### Environment Variables

```bash
# eas.json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your-anon-key"
      }
    }
  }
}
```

---

## Git Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation

### Commit Messages

```
feat: add user profile screen
fix: resolve crash on logout
refactor: extract auth logic to hook
docs: update README with setup instructions
```

### Pre-commit Checks

```bash
# package.json scripts
{
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "precommit": "npm run lint && npm run typecheck && npm run test"
  }
}
```
