// src/hooks/useAuth.ts
"use client";
import { useState } from "react";

// Minimal placeholder hook
export function useAuth() {
  // You can replace this with real auth later (Firebase, NextAuth, etc.)
  const [user] = useState({
    uid: "dummy-uid",
    displayName: "Test User",
    email: "test@example.com",
  });

  return { user };
}