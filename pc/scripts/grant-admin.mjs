#!/usr/bin/env node
/**
 * Grant (or revoke) the admin role for an existing account.
 *
 *   npm run admin:grant -- someone@example.com
 *   npm run admin:grant -- someone@example.com --revoke
 *
 * Reads MONGODB_URI (and MONGODB_DB) from the environment or the project's
 * .env files, exactly like the app. The account must already exist — sign up
 * first. For hands-off setups, ADMIN_EMAILS grants the role automatically once
 * an address is verified.
 */
import nextEnv from "@next/env";
import { MongoClient } from "mongodb";

nextEnv.loadEnvConfig(process.cwd());

const [email, flag] = process.argv.slice(2);
if (!email || !email.includes("@")) {
  console.error("Usage: npm run admin:grant -- <email> [--revoke]");
  process.exit(1);
}

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/plantguard";
const fromUri = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/.exec(uri)?.[1];
const dbName =
  process.env.MONGODB_DB ||
  (fromUri ? decodeURIComponent(fromUri) : "") ||
  "plantguard";
const role = flag === "--revoke" ? "user" : "admin";

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
try {
  await client.connect();
  const result = await client
    .db(dbName)
    .collection("user")
    .updateOne(
      { email: email.trim().toLowerCase() },
      { $set: { role, updatedAt: new Date() } },
    );

  if (result.matchedCount === 0) {
    console.error(`No account found for ${email} in database "${dbName}".`);
    process.exitCode = 1;
  } else {
    console.log(
      `${email} is now ${role === "admin" ? "an admin" : "a regular user"}.`,
    );
    console.log(
      "It takes effect within 5 minutes (the session cookie cache), or on next sign-in.",
    );
  }
} finally {
  await client.close();
}
