# System Architecture & Agent Instructions

## Overview

This document serves as the system prompt for AI agents working on this codebase. It defines architectural decisions, coding standards, and constraints.

---

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Mobile | Expo (React Native) | SDK 50+ |
| Navigation | Expo Router | v3+ |
| State (Client) | Zustand | v4+ |
| State (Server) | TanStack Query | v5+ |
| Backend | Supabase | Latest |
| Edge Runtime | Deno | Latest |
| Language | TypeScript | 5+ |

---

## Architecture Decisions

### 1. Direct Supabase vs Edge Functions

**Use Direct Supabase When:**
- Simple CRUD operations
- RLS policies handle authorization
- No complex joins or transforms
- No external API calls needed

**Use Edge Functions When:**
- Complex authorization logic
- External API integration
- Heavy computation
- Custom validation beyond RLS
- Webhook handlers

### 2. State Management Split

```
┌─────────────────────────────────────────────┐
│                 State Type                   │
├─────────────────────────────────────────────┤
│  Server State  →  TanStack Query            │
│  (API data, cached, async)                  │
├─────────────────────────────────────────────┤
│  Client State  →  Zustand                   │
│  (UI state, theme, modals)                  │
├─────────────────────────────────────────────┤
│  Form State    →  React Hook Form           │
│  (Input values, validation)                 │
└─────────────────────────────────────────────┘
```

### 3. File Structure Rules

```
src/
├── components/
│   ├── ui/           # Max 100 lines per component
│   ├── forms/        # One form per file
│   └── screens/      # Screen wrappers only
├── hooks/
│   ├── queries/      # One hook per entity
│   ├── mutations/    # One hook per action
│   └── stores/       # One store per domain
├── lib/              # External integrations only
├── types/            # Types co-located with features preferred
└── utils/            # Pure functions only
```

---

## Coding Standards

### TypeScript

```typescript
// ✅ DO: Explicit types for function parameters
function createUser(input: CreateUserInput): Promise<User> {}

// ✅ DO: Infer return types when obvious
const formatDate = (date: Date) => date.toISOString();

// ❌ DON'T: Use `any`
function process(data: any) {} // Bad

// ❌ DON'T: Ignore errors
// @ts-ignore // Bad
```

### Components

```typescript
// ✅ DO: Destructure props with types
interface ButtonProps {
  title: string;
  onPress: () => void;
}

function Button({ title, onPress }: ButtonProps) {}

// ✅ DO: Use named exports
export function Button() {}

// ❌ DON'T: Use default exports for components
export default function Button() {} // Bad
```

### Hooks

```typescript
// ✅ DO: Follow naming convention
export function useUserData() {}      // Query
export function useCreateUser() {}    // Mutation
export function useAuthStore() {}     // Store

// ✅ DO: Return consistent shapes
return {
  data,
  isLoading,
  error,
  refetch,
};

// ❌ DON'T: Mix concerns in one hook
function useUserAndPosts() {} // Bad - split into useUser and usePosts
```

### Edge Functions

```typescript
// ✅ DO: Minimal imports at top level
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// ✅ DO: Lazy load heavy dependencies
const getOpenAI = async () => {
  const { OpenAI } = await import('openai');
  return new OpenAI();
};

// ✅ DO: Always handle CORS
if (req.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders });
}

// ✅ DO: Log errors with context
console.error('Error in create-user:', { userId, error: err.message });

// ❌ DON'T: Use raw SQL execution
await supabase.rpc('exec', { sql: '...' }); // Bad
```

---

## Performance Rules

### 1. Never Block UI on Network

```typescript
// ❌ BAD: Blocking
const handleSubmit = async () => {
  setLoading(true);
  await createPost(data);
  setLoading(false);
};

// ✅ GOOD: Optimistic
const { mutate } = useCreatePost();
const handleSubmit = () => {
  mutate(data); // Returns immediately, updates UI optimistically
};
```

### 2. Cache Aggressively

```typescript
// React Query defaults (already configured)
{
  staleTime: 1000 * 60 * 5,  // 5 minutes
  gcTime: 1000 * 60 * 30,    // 30 minutes
}
```

### 3. Virtualize Lists

```typescript
// ✅ Always use FlashList for lists > 20 items
import { FlashList } from '@shopify/flash-list';

<FlashList
  data={items}
  renderItem={renderItem}
  estimatedItemSize={80}
/>
```

### 4. Lazy Load Screens

```typescript
// ✅ Use React.lazy for non-critical screens
const SettingsScreen = React.lazy(() => import('./SettingsScreen'));
```

---

## Security Rules

### 1. Never Trust Client Data

```typescript
// ❌ BAD: Trust client-provided user ID
const { userId } = await req.json();
await supabase.from('posts').insert({ user_id: userId });

// ✅ GOOD: Get user from auth
const { data: { user } } = await supabase.auth.getUser();
await supabase.from('posts').insert({ user_id: user.id });
```

### 2. Always Use RLS

```sql
-- Every table must have RLS enabled
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- With appropriate policies
CREATE POLICY "Users can only see own posts"
  ON posts FOR SELECT
  USING (auth.uid() = user_id);
```

### 3. Validate All Inputs

```typescript
// ✅ Use Zod in Edge Functions
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
});

const input = schema.parse(await req.json());
```

### 4. No Secrets in Client Code

```typescript
// ❌ NEVER in client code
const apiKey = 'sk-xxx';

// ✅ Only in Edge Functions via env
const apiKey = Deno.env.get('OPENAI_API_KEY');
```

---

## Error Handling

### Client Side

```typescript
// ✅ Use error boundaries
<ErrorBoundary fallback={<ErrorScreen />}>
  <App />
</ErrorBoundary>

// ✅ Handle query errors
const { data, error } = useQuery(...);
if (error) return <ErrorMessage error={error} />;

// ✅ Show toast for mutations
onError: (error) => {
  Toast.show({ type: 'error', text1: error.message });
}
```

### Edge Functions

```typescript
// ✅ Consistent error responses
return new Response(
  JSON.stringify({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }),
  { status: 401, headers: corsHeaders }
);

// ✅ Log all errors
console.error('Function error:', { 
  function: 'create-post',
  userId: user?.id,
  error: err.message,
  stack: err.stack,
});
```

---

## AI Agent Instructions

When working on this codebase:

### DO:
- Follow the file structure exactly
- Use existing hooks and utilities
- Add TypeScript types for all new code
- Include error handling
- Add console.log for debugging in Edge Functions
- Use optimistic updates for mutations
- Keep components under 100 lines
- Split large files into focused modules

### DON'T:
- Create new patterns without justification
- Use `any` type
- Skip error handling
- Add unnecessary dependencies
- Use default exports for components
- Put business logic in components
- Make synchronous API calls that block UI
- Store secrets in client code
- Execute raw SQL in Edge Functions

### WHEN IN DOUBT:
- Check existing code for patterns
- Prefer smaller, focused changes
- Ask for clarification rather than assume
- Prioritize mobile performance
- Consider offline scenarios
