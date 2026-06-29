import { defineEventHandler } from "h3";
import { pingDatabase } from "../../utils/supabase";
import { json, error } from "../../utils/http";

export default defineEventHandler(async () => {
  try {
    await pingDatabase();
    return json({ status: "ok", database: "connected" });
  } catch (err) {
    console.error("health db error", err);
    const message = err instanceof Error ? err.message : "database error";
    return error(message, 500);
  }
});
