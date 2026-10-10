"use client";

import { Portal, Z } from "@/components/overlay";

/** Shared toast — solid pill above nav, below lightbox. */
export default function Toast({ message }: { message: string }) {
  return (
    <Portal>
      {message && (
        <div
          className="fixed bottom-28 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-full bg-white text-black text-xs font-semibold shadow-2xl whitespace-nowrap max-w-[calc(100vw-2rem)] overflow-hidden text-ellipsis"
          style={{ zIndex: Z.toast }}
          role="status"
        >
          {message}
        </div>
      )}
    </Portal>
  );
}
