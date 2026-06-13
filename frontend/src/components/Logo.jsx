import React from "react";
import logo from "@/assets/logo.jpeg";

/** Round TOP LOTTO logo with gold ring. */
export default function Logo({ size = 40, className = "", ring = true }) {
  return (
    <div
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={logo}
        alt="TOP LOTTO"
        draggable={false}
        className={`w-full h-full rounded-full object-cover ${ring ? "ring-2 ring-yellow-400" : ""}`}
        style={{
          boxShadow: ring ? "0 0 14px rgba(250, 204, 21, 0.35)" : undefined,
        }}
      />
    </div>
  );
}
