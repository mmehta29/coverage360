"use client";

import { Auth0Provider } from "@auth0/nextjs-auth0/client";

export function Providers({ children }: { children: React.ReactNode }) {
  if (process.env.NEXT_PUBLIC_SKIP_AUTH === "true") {
    return <>{children}</>;
  }
  return <Auth0Provider>{children}</Auth0Provider>;
}
