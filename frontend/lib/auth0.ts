import { Auth0Client } from "@auth0/nextjs-auth0/server";

export const auth0 = process.env.AUTH0_DOMAIN
  ? new Auth0Client()
  : null as unknown as Auth0Client;
