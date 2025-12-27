# Edge Functions Guide

## Overview

Supabase Edge Functions run on Deno at the edge. They're serverless, meaning they have cold starts. This guide covers patterns optimized for mobile apps.

---

## Cold Start Mitigation

### The Problem

Cold starts add 500ms-2000ms latency. For mobile users on slow networks, this compounds with network latency.

### Solutions

#### 1. Minimal Imports

```typescript
// ❌ BAD - Heavy imports at top level
import { OpenAI } from 'openai';
import { z } from 'zod';
import { format, parse, addDays } from 'date-fns';

// ✅ GOOD - Lazy imports
const getOpenAI = async () => {
  const { OpenAI } = await import('openai');
  return new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });
};
```

#### 2. Shared Modules

Create `supabase/functions/_shared/`:

```typescript
// _shared/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// _shared/response.ts
export const json = (data: unknown, status = 200) => 
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

export const error = (message: string, status = 400) =>
  json({ error: message }, status);

// _shared/auth.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const getUser = async (req: Request) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  return user;
};
```

---

## Function Templates

### Template 1: Auth-Protected CRUD

```typescript
// supabase/functions/get-user-data/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json, error } from '../_shared/response.ts';

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return error('Missing authorization', 401);
    }

    // Create authenticated client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return error('Invalid token', 401);
    }

    // Fetch data
    const { data, error: dbError } = await supabase
      .from('user_data')
      .select('*')
      .eq('user_id', user.id);

    if (dbError) {
      console.error('DB Error:', dbError);
      return error('Database error', 500);
    }

    return json({ data });

  } catch (err) {
    console.error('Unexpected error:', err);
    return error('Internal server error', 500);
  }
});
```

### Template 2: Public Validation

```typescript
// supabase/functions/validate-input/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, json, error } from '../_shared/response.ts';

// Inline validation to avoid import overhead
const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name } = await req.json();

    const errors: string[] = [];

    if (!email || !validateEmail(email)) {
      errors.push('Invalid email format');
    }

    if (!name || name.length < 2) {
      errors.push('Name must be at least 2 characters');
    }

    if (errors.length > 0) {
      return json({ valid: false, errors }, 400);
    }

    return json({ valid: true });

  } catch (err) {
    return error('Invalid request body', 400);
  }
});
```

### Template 3: AI/Heavy Compute (Background Pattern)

```typescript
// supabase/functions/generate-content/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json, error } from '../_shared/response.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return error('Unauthorized', 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user } } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (!user) return error('Invalid token', 401);

    const { prompt, jobId } = await req.json();

    // Create job record immediately
    await supabase.from('ai_jobs').insert({
      id: jobId,
      user_id: user.id,
      status: 'processing',
      prompt,
    });

    // Process in background (don't await)
    EdgeRuntime.waitUntil(processAIJob(supabase, jobId, prompt));

    // Return immediately with job ID
    return json({ jobId, status: 'processing' });

  } catch (err) {
    console.error('Error:', err);
    return error('Internal error', 500);
  }
});

async function processAIJob(supabase: any, jobId: string, prompt: string) {
  try {
    // Lazy load heavy dependency
    const { OpenAI } = await import('https://esm.sh/openai@4');
    const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    });

    await supabase.from('ai_jobs').update({
      status: 'completed',
      result: response.choices[0].message.content,
      completed_at: new Date().toISOString(),
    }).eq('id', jobId);

  } catch (err) {
    await supabase.from('ai_jobs').update({
      status: 'failed',
      error: err.message,
    }).eq('id', jobId);
  }
}
```

---

## config.toml Setup

```toml
[project]
id = "your-project-ref"

# Auth-protected function (default)
[functions.get-user-data]
verify_jwt = true

# Public function (no auth required)
[functions.validate-input]
verify_jwt = false

# AI function (auth required)
[functions.generate-content]
verify_jwt = true
```

---

## Calling from Mobile

### Direct Call

```typescript
// src/lib/api.ts
import { supabase } from './supabase';

export const api = {
  async getUserData() {
    const { data, error } = await supabase.functions.invoke('get-user-data');
    if (error) throw error;
    return data;
  },

  async validateInput(input: { email: string; name: string }) {
    const { data, error } = await supabase.functions.invoke('validate-input', {
      body: input,
    });
    if (error) throw error;
    return data;
  },

  async generateContent(prompt: string) {
    const jobId = crypto.randomUUID();
    const { data, error } = await supabase.functions.invoke('generate-content', {
      body: { prompt, jobId },
    });
    if (error) throw error;
    return data;
  },
};
```

### With React Query

```typescript
// src/hooks/queries/useUserData.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const useUserData = () => {
  return useQuery({
    queryKey: ['user-data'],
    queryFn: api.getUserData,
    staleTime: 1000 * 60 * 5,
  });
};
```

---

## Error Handling Pattern

```typescript
// _shared/error-handler.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 400
  ) {
    super(message);
  }
}

export const handleError = (err: unknown) => {
  if (err instanceof AppError) {
    return json({ error: err.message, code: err.code }, err.status);
  }
  
  console.error('Unexpected error:', err);
  return json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
};
```

---

## Testing Locally

```bash
# Start local Supabase
supabase start

# Serve functions locally
supabase functions serve

# Test with curl
curl -X POST http://localhost:54321/functions/v1/validate-input \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "name": "Test"}'
```

---

## Deployment

```bash
# Deploy single function
supabase functions deploy get-user-data

# Deploy all functions
supabase functions deploy

# Set secrets
supabase secrets set OPENAI_API_KEY=sk-xxx
```

---

## Performance Checklist

- [ ] Minimal top-level imports
- [ ] Shared code in `_shared/`
- [ ] Auth check is fast (no heavy deps)
- [ ] Heavy compute uses background processing
- [ ] Proper error handling with logging
- [ ] CORS headers on all responses
- [ ] Appropriate `verify_jwt` settings
