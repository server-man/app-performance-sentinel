# Setup Guide

## Prerequisites

- Node.js 18+
- npm or yarn or bun
- Expo CLI (`npm install -g expo-cli`)
- Supabase CLI (`npm install -g supabase`)
- Docker (for local Supabase)

---

## 1. Project Initialization

### Option A: New Expo Project

```bash
# Create new Expo project with TypeScript
npx create-expo-app@latest my-app --template expo-template-blank-typescript

cd my-app
```

### Option B: Existing Project

```bash
cd your-existing-project
```

---

## 2. Install Dependencies

### Core Dependencies

```bash
# Navigation
npx expo install expo-router expo-linking expo-constants expo-status-bar

# Supabase
npm install @supabase/supabase-js

# State Management
npm install @tanstack/react-query zustand

# Storage
npx expo install @react-native-async-storage/async-storage

# UI Essentials
npx expo install expo-haptics expo-linear-gradient
npm install react-native-reanimated react-native-gesture-handler

# Utilities
npm install zod date-fns
```

### Dev Dependencies

```bash
npm install -D typescript @types/react @types/react-native
```

---

## 3. Supabase Setup

### Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Note your:
   - Project URL
   - Anon Key
   - Service Role Key (for Edge Functions)

### Initialize Local Supabase

```bash
# Initialize Supabase in project
supabase init

# Start local Supabase (requires Docker)
supabase start

# Link to remote project
supabase link --project-ref YOUR_PROJECT_REF
```

### Environment Variables

Create `.env` file:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## 4. Project Configuration

### app.json

```json
{
  "expo": {
    "name": "Your App",
    "slug": "your-app",
    "version": "1.0.0",
    "scheme": "your-app",
    "platforms": ["ios", "android"],
    "ios": {
      "bundleIdentifier": "com.yourcompany.yourapp",
      "supportsTablet": true
    },
    "android": {
      "package": "com.yourcompany.yourapp",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#000000"
      }
    },
    "plugins": [
      "expo-router"
    ]
  }
}
```

### tsconfig.json

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@hooks/*": ["src/hooks/*"],
      "@lib/*": ["src/lib/*"],
      "@types/*": ["src/types/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

### babel.config.js

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            '@components': './src/components',
            '@hooks': './src/hooks',
            '@lib': './src/lib',
            '@types': './src/types',
          },
        },
      ],
    ],
  };
};
```

---

## 5. Supabase Client Setup

Create `src/lib/supabase.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'x-client-info': 'expo-app',
    },
  },
});
```

---

## 6. React Query Setup

Create `src/lib/query-client.ts`:

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
});
```

---

## 7. Directory Structure Setup

```bash
# Create directory structure
mkdir -p src/{components/{ui,forms,screens},hooks/{queries,mutations,stores},lib,types,utils}
mkdir -p supabase/functions/_shared
mkdir -p app/{(auth),(public)}
```

---

## 8. Verify Installation

```bash
# Start Expo dev server
npx expo start

# In another terminal, start local Supabase
supabase start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android
```

---

## 9. Edge Functions Setup

```bash
# Create your first Edge Function
supabase functions new hello-world

# Serve locally for development
supabase functions serve

# Deploy to production
supabase functions deploy hello-world
```

---

## Troubleshooting

### Metro bundler issues

```bash
npx expo start --clear
```

### Supabase connection issues

1. Check your environment variables
2. Ensure Supabase project is running
3. Check network connectivity

### TypeScript path aliases not working

```bash
npm install -D babel-plugin-module-resolver
```

---

## Next Steps

→ Read `docs/DEV_GUIDE.md` for development workflow
→ Read `docs/EDGE_FUNCTIONS.md` for backend patterns
