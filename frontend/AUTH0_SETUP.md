# Auth0 Setup

This project uses `@auth0/nextjs-auth0` v4.x for authentication.

## 1. Create `frontend/.env.local`

Copy this template and fill in your values:

```env
BACKEND_URL=http://127.0.0.1:8000

# Auth0 Configuration (v4.x)
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
AUTH0_SECRET=your_random_secret_at_least_32_chars
APP_BASE_URL=http://localhost:3000
```

To generate `AUTH0_SECRET`:
```bash
openssl rand -hex 32
```

## 2. Auth0 Dashboard Configuration

In the [Auth0 Dashboard](https://manage.auth0.com), configure your application:

### Allowed Callback URLs
```
http://localhost:3000/auth/callback
```

### Allowed Logout URLs
```
http://localhost:3000
```

### Allowed Web Origins
```
http://localhost:3000
```

> **Note:** The callback URL is `/auth/callback` (not `/api/auth/callback`). This changed in v4.x.

## 3. Project Structure

The Auth0 integration consists of these files:

```
frontend/
├── lib/
│   └── auth0.ts          # Auth0Client instance
├── middleware.ts         # Handles /auth/* routes
└── app/
    └── providers.tsx     # Client-side Auth0Provider
```

### `lib/auth0.ts`
Server-side Auth0 client. Import this in server components to get session/user data:
```ts
import { auth0 } from "@/lib/auth0";
const session = await auth0.getSession();
```

### `middleware.ts`
Automatically handles these routes:
- `/auth/login` - Redirects to Auth0 login
- `/auth/logout` - Logs out and redirects home
- `/auth/callback` - Handles Auth0 callback

### `app/providers.tsx`
Client-side provider. Wraps the app in `layout.tsx` to provide `useUser()` hook.

## 4. Run Locally

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## 5. Usage in Components

### Server Components
```ts
import { auth0 } from "@/lib/auth0";

export default async function Page() {
  const session = await auth0.getSession();

  if (!session) {
    return <a href="/auth/login">Login</a>;
  }

  return <p>Hello, {session.user.name}</p>;
}
```

### Client Components
```tsx
"use client";
import { useUser } from "@auth0/nextjs-auth0/client";

export default function Profile() {
  const { user, isLoading } = useUser();

  if (isLoading) return <div>Loading...</div>;
  if (!user) return <a href="/auth/login">Login</a>;

  return <p>Hello, {user.name}</p>;
}
```

## Troubleshooting

### "Callback URL mismatch"
- Verify `/auth/callback` (not `/api/auth/callback`) is in Auth0 Allowed Callback URLs
- Restart `npm run dev` after changing `.env.local`

### "Auth0Client is not a constructor"
- Make sure you're on `@auth0/nextjs-auth0` v4.x: `npm install @auth0/nextjs-auth0@latest`

### Session not persisting
- Check `AUTH0_SECRET` is set and at least 32 characters
- Check `APP_BASE_URL` matches your dev server URL
