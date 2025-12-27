# Architecture Overview

## Mobile-First React Native + Supabase Edge Functions

This document outlines the production-grade architecture for a mobile app optimized for performance, cold start mitigation, and excellent UX.

---

## Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Mobile | Expo (React Native) | Cross-platform mobile app |
| State | Zustand + React Query | Client state + server cache |
| Backend | Supabase Edge Functions | Serverless API layer |
| Database | Supabase PostgreSQL | Persistent storage |
| Auth | Supabase Auth | Authentication & sessions |
| Storage | Supabase Storage | File uploads |

---

## Directory Structure

```
├── app/                    # Expo Router pages
│   ├── (auth)/            # Auth-required routes
│   ├── (public)/          # Public routes
│   └── _layout.tsx        # Root layout
├── src/
│   ├── components/
│   │   ├── ui/            # Base UI components
│   │   ├── forms/         # Form components
│   │   └── screens/       # Screen-level components
│   ├── hooks/
│   │   ├── queries/       # React Query hooks
│   │   ├── mutations/     # Mutation hooks
│   │   └── stores/        # Zustand stores
│   ├── lib/
│   │   ├── supabase.ts    # Supabase client
│   │   ├── api.ts         # API utilities
│   │   └── constants.ts   # App constants
│   ├── types/             # TypeScript types
│   └── utils/             # Utility functions
├── supabase/
│   ├── functions/         # Edge Functions
│   │   ├── _shared/       # Shared utilities
│   │   └── [function]/    # Individual functions
│   ├── migrations/        # Database migrations
│   └── config.toml        # Supabase config
└── docs/                  # Documentation
```

---

## Core Principles

### 1. Cold Start Mitigation

Edge Functions suffer from cold starts (500ms-2s). Mitigate by:

- **Keep functions lightweight** - Minimal imports
- **Use shared modules** - Common code in `_shared/`
- **Lazy load heavy deps** - Import inside handler when possible
- **Warm critical paths** - Background pings for auth functions

### 2. Mobile-First Data Strategy

```
┌─────────────────────────────────────────────────────┐
│                    Mobile App                        │
├─────────────────────────────────────────────────────┤
│  Optimistic UI  →  React Query Cache  →  Zustand   │
│       ↓                   ↓                  ↓      │
│  Instant feedback    Server sync       Local state  │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│              Supabase Edge Functions                 │
├─────────────────────────────────────────────────────┤
│  Validation  →  Auth Check  →  DB Operation         │
└─────────────────────────────────────────────────────┘
```

### 3. Network Resilience

- Retry with exponential backoff
- Offline queue for mutations
- Stale-while-revalidate for reads
- Request deduplication

---

## Edge Function Classification

| Type | Cold Start Risk | Mobile Impact | Example |
|------|-----------------|---------------|---------|
| Auth Guard | Medium | Critical | `verify-session` |
| Validation | Low | Moderate | `validate-input` |
| CRUD Proxy | Low | Moderate | `get-user-data` |
| AI/Heavy | High | UX-Breaking | `generate-content` |
| Webhook | N/A | None | `stripe-webhook` |

### Recommendations by Type

**Auth Functions**: Keep under 50KB, no heavy deps, warm with background pings

**CRUD Functions**: Use direct Supabase client when possible, Edge only for complex logic

**AI Functions**: Never block UI, use background jobs + polling/websockets

---

## Performance Budgets

| Metric | Target | Acceptable | Poor |
|--------|--------|------------|------|
| App Cold Start | <2s | <4s | >4s |
| Edge Cold Start | <500ms | <1s | >1s |
| Hot Request | <100ms | <300ms | >300ms |
| Time to Interactive | <3s | <5s | >5s |

---

## Authentication Flow

```
App Launch
    │
    ├─→ Check AsyncStorage for session
    │       │
    │       ├─→ Valid token? → Validate with Edge (background)
    │       │                        │
    │       │                        └─→ Update session if needed
    │       │
    │       └─→ No token? → Show auth screen
    │
    └─→ Show cached UI immediately (optimistic)
```

---

## Data Fetching Patterns

### Pattern 1: Simple Read (No Edge)

```typescript
// Direct Supabase query - fastest path
const { data } = await supabase
  .from('items')
  .select('*')
  .eq('user_id', userId);
```

### Pattern 2: Complex Read (Edge Required)

```typescript
// Edge function for joins, transforms, auth checks
const { data } = await supabase.functions.invoke('get-dashboard', {
  body: { userId }
});
```

### Pattern 3: Optimistic Mutation

```typescript
// Update UI immediately, sync in background
mutate(newData, {
  optimisticData: [...current, newItem],
  rollbackOnError: true,
  revalidate: true
});
```

---

## Security Model

1. **Row Level Security (RLS)** - Database-level access control
2. **Edge Auth Middleware** - JWT validation in functions
3. **Input Validation** - Zod schemas in Edge functions
4. **Rate Limiting** - Per-user request limits

---

## Next Steps

1. Read `docs/SETUP.md` for installation
2. Read `docs/EDGE_FUNCTIONS.md` for backend patterns
3. Read `docs/MOBILE_OPTIMIZATION.md` for performance
4. Read `docs/DEV_GUIDE.md` for development workflow
