import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Ensure `.env` / `.env.local` are loaded before any config reads `process.env`
// (fixes Supabase URL/key missing in `src/proxy.ts` under Turbopack dev).
loadEnvConfig(process.cwd());

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
