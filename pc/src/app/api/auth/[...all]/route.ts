import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/auth";

/** Every Better Auth endpoint: sign-in, sign-up, sessions, email flows, admin. */
export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler(
  async (request) => (await getAuth()).handler(request),
);
