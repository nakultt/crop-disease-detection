import { NextResponse } from "next/server";
import { withSession } from "@/server/api";
import { logger } from "@/server/logger";
import { deleteAllScansForUser } from "@/server/scans";

/** DELETE /api/account/scans — clear the signed-in user's entire history. */
export const DELETE = withSession(
  async (_request, _context: unknown, session) => {
    const deleted = await deleteAllScansForUser(session.user.id);
    logger.info("User cleared their scan history", {
      userId: session.user.id,
      deleted,
    });
    return NextResponse.json({ deleted });
  },
);
