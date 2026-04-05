# Auth0 Setup

The frontend uses Auth0 for login.

## 1. Create `frontend/.env.local`

Use this shape:

```env
BACKEND_URL=http://127.0.0.1:8000
ELEVENLABS_API_KEY=

APP_BASE_URL=http://localhost:3000
AUTH0_BASE_URL=http://localhost:3000
AUTH0_DOMAIN=dev-chyogq41gjlfelzz.us.auth0.com
AUTH0_ISSUER_BASE_URL=https://dev-chyogq41gjlfelzz.us.auth0.com
AUTH0_CLIENT_ID=YOUR_CLIENT_ID
AUTH0_CLIENT_SECRET=YOUR_CLIENT_SECRET
AUTH0_SECRET=YOUR_RANDOM_SECRET
```

Notes:
- `AUTH0_SECRET` should be a long random string.
- `AUTH0_ISSUER_BASE_URL` is your Auth0 tenant URL, not your localhost callback URL.

## 2. Auth0 Application Settings

In the Auth0 dashboard, set:

### Allowed Callback URLs

```text
http://localhost:3000/auth/callback, http://localhost:3000/api/auth/callback
```

### Allowed Logout URLs

```text
http://localhost:3000
```

### Allowed Web Origins

```text
http://localhost:3000
```

## 3. Run locally

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## 4. Test

1. Open `http://localhost:3000`
2. Click login
3. Complete Auth0 Universal Login
4. Confirm you land back in the app
5. Test logout

## Troubleshooting

If you get `Callback URL mismatch`:

- make sure both callback URLs are saved in Auth0
- make sure `APP_BASE_URL` and `AUTH0_BASE_URL` are both `http://localhost:3000`
- restart `npm run dev` after changing env vars
