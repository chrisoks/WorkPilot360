import { randomUUID } from "node:crypto";

process.env.WORKPILOT_INTERNAL_AUTOMATION_TOKEN =
  process.env.WORKPILOT_INTERNAL_AUTOMATION_TOKEN?.trim() ||
  process.env.PUSH_REMINDER_CRON_SECRET?.trim() ||
  randomUUID();

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
    instrumentationHook: true
  }
};

export default nextConfig;
