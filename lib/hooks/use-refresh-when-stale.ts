"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";

// For dialogs that edit or delete a list item which turns out to be gone (deleted in another
// tab). Refreshing right away would remove the item, and the open dialog with it, before the
// user could read the message. So: markStale() when the message is shown, and
// refreshIfStale() when the dialog closes.
export const useRefreshWhenStale = () => {
  const router = useRouter();
  const stale = useRef(false);

  return {
    markStale() {
      stale.current = true;
    },
    refreshIfStale() {
      if (!stale.current) return;
      stale.current = false;
      router.refresh();
    },
  };
};
