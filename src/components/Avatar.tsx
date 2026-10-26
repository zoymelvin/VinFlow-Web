"use client";

import { useState } from "react";
import { initials } from "@/lib/settings";
import { cn } from "@/lib/utils";

export default function Avatar({ name, photo, size = "lg" }: {
  name: string; photo: string; size?: "lg" | "md" | "sm";
}) {
  const dims = size === "lg" ? "w-20 h-20 text-3xl" : size === "md" ? "w-12 h-12 text-xl" : "w-9 h-9 text-base";
  
  const [loaded, setLoaded] = useState(false);
  
  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        onLoad={() => setLoaded(true)}
        className={cn(
            "rounded-full border border-white/10 object-cover shrink-0 transition-opacity duration-300", 
            dims,
            loaded ? "opacity-100" : "opacity-0"
        )}
        decoding="async"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn("rounded-full border border-blue-500/20 bg-blue-500/10 flex items-center justify-center shrink-0 font-bold text-blue-400", dims)}
    >
      {initials(name)}
    </span>
  );
}
