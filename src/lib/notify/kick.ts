import { after } from "next/server";
import { processOutbox } from "./outbox";

/**
 * Send queued messages once the current response has gone out. Call it after anything that
 * queues a message. Outside a request (tests, scripts) there is nothing to hook into, so it
 * does nothing and the scheduled /api/cron/messages run picks the messages up instead.
 */
export function kickOutbox(): void {
  try {
    after(async () => {
      try {
        await processOutbox();
      } catch (e) {
        console.error("[outbox] run failed", e instanceof Error ? e.message : "unknown error");
      }
    });
  } catch {
    // not inside a request
  }
}
