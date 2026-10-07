"use client";

import { useEffect } from "react";
import { markUpdatesSeenAction } from "@/app/actions/account";

/** Clears the unread badge once the person has opened the Updates page. */
export default function MarkSeen() {
  useEffect(() => {
    void markUpdatesSeenAction();
  }, []);
  return null;
}
