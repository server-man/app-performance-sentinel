# Troubleshooting Guide

## Common Issues

### Metro Bundler

#### "Unable to resolve module"

```bash
# Clear cache and restart
npx expo start --clear

# Or full reset
rm -rf node_modules
rm -rf .expo
npm install
npx expo start --clear
```

#### "SHA-1 collision detected"

```bash
# Clean watchman
watchman watch-del-all

# Clear metro cache
rm -rf $TMPDIR/metro-*
```

---

### Supabase Connection

#### "Invalid API key"

1. Check `.env` file has correct keys
2. Ensure keys start with `EXPO_PUBLIC_`
3. Restart Expo after changing env vars

```bash
# Verify environment
echo $EXPO_PUBLIC_SUPABASE_URL
```

#### "Network request failed"

1. Check if Supabase is running: `supabase status`
2. Verify URL in `.env`
3. Check device network connectivity

```bash
# For local development
supabase start
# Verify: http://localhost:54321
```

#### "JWT expired"

```typescript
// Refresh session manually
const { data, error } = await supabase.auth.refreshSession();
```

---

### Edge Functions

#### "Function not found"

```bash
# Deploy the function
supabase functions deploy function-name

# Verify it's deployed
supabase functions list
```

#### "CORS error"

Ensure your function handles OPTIONS:

```typescript
if (req.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders });
}
```

#### "Cold start timeout"

1. Reduce imports
2. Use lazy loading
3. Move heavy code to background

```typescript
// Lazy load heavy deps
const getHeavyLib = async () => {
  return await import('heavy-library');
};
```

#### "Cannot find module"

Use URL imports in Deno:

```typescript
// ✅ Correct
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// ❌ Wrong
import { serve } from 'std/http/server.ts';
```

---

### React Query

#### "Query stuck in loading"

```typescript
// Check if enabled condition is correct
const { data } = useQuery({
  queryKey: ['post', postId],
  queryFn: () => fetchPost(postId),
  enabled: !!postId, // Must be truthy
});
```

#### "Infinite refetching"

```typescript
// Avoid recreating queryFn
const { data } = useQuery({
  queryKey: ['posts', userId],
  queryFn: () => fetchPosts(userId), // userId in key prevents refetch loops
});
```

#### "Stale data after mutation"

```typescript
// Invalidate queries after mutation
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['posts'] });
}
```

---

### TypeScript

#### "Cannot find module '@/...'"

Check `tsconfig.json` paths:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

And `babel.config.js`:

```javascript
plugins: [
  ['module-resolver', {
    alias: {
      '@': './src',
    },
  }],
]
```

#### "Type 'X' is not assignable to type 'Y'"

```typescript
// Use proper type assertions
const data = response as MyType;

// Or type guards
if (isMyType(data)) {
  // data is MyType here
}
```

---

### React Native

#### "Invariant Violation: TurboModuleRegistry"

```bash
# Rebuild native code
npx expo prebuild --clean
npx expo run:ios
```

#### "Unable to load script"

```bash
# iOS
npx expo run:ios --device

# Android
adb reverse tcp:8081 tcp:8081
npx expo run:android
```

#### "Application has not been registered"

Check `app.json` has correct name:

```json
{
  "expo": {
    "name": "YourApp",
    "slug": "your-app"
  }
}
```

---

### Build Issues

#### EAS Build fails

```bash
# Check build logs
eas build:list
eas build:view

# Common fixes
eas credentials
eas build --clear-cache
```

#### "CocoaPods not found"

```bash
# Install CocoaPods
sudo gem install cocoapods

# Or with Homebrew
brew install cocoapods

# Install pods
cd ios && pod install && cd ..
```

#### Android gradle issues

```bash
# Clean gradle
cd android
./gradlew clean
cd ..

# Rebuild
npx expo run:android
```

---

### Authentication

#### "Email not confirmed"

In Supabase Dashboard:
1. Go to Authentication > Settings
2. Disable "Enable email confirmations" for development

#### "Invalid login credentials"

1. Verify user exists in Supabase Auth
2. Check password is correct
3. Check if user is banned

```typescript
// Debug auth state
const { data: { user }, error } = await supabase.auth.getUser();
console.log('User:', user, 'Error:', error);
```

#### "Session lost on app restart"

Ensure AsyncStorage is configured:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabase = createClient(url, key, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
  },
});
```

---

### Performance

#### "App is slow/janky"

1. Check for re-renders: `why-did-you-render`
2. Virtualize lists: Use FlashList
3. Memoize expensive computations

```typescript
// Memoize
const expensive = useMemo(() => computeExpensive(data), [data]);

// Prevent re-renders
const MemoizedComponent = React.memo(MyComponent);
```

#### "Memory warning"

1. Check for memory leaks in useEffect
2. Clean up subscriptions
3. Optimize images

```typescript
useEffect(() => {
  const subscription = subscribe();
  return () => subscription.unsubscribe(); // Cleanup!
}, []);
```

---

## Debug Commands

```bash
# Expo diagnostics
npx expo doctor

# Supabase status
supabase status

# Check logs
supabase functions logs function-name

# React Native info
npx react-native info

# Clear all caches
rm -rf node_modules .expo ios/Pods android/.gradle
npm install
cd ios && pod install && cd ..
```

---

## Getting Help

1. Check this guide first
2. Search existing issues on GitHub
3. Check Expo/Supabase Discord
4. Create issue with:
   - Error message
   - Steps to reproduce
   - Environment info (`npx expo doctor`)
