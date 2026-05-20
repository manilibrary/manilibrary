"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";

const MESSAGES: Record<string, string> = {
  email_verified: "Email verified. You're signed in.",
};

export default function AuthToastListener() {
  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)auth_toast=([^;]+)/);
    if (!match) return;
    const key = decodeURIComponent(match[1]);
    document.cookie = "auth_toast=; path=/; max-age=0";
    const msg = MESSAGES[key];
    if (msg) toast.success(msg);
  }, []);

  return null;
}
