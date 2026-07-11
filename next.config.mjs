import { randomUUID } from "node:crypto";

process.env.WORKPILOT_INTERNAL_AUTOMATION_TOKEN =
  process.env.WORKPILOT_INTERNAL_AUTOMATION_TOKEN?.trim() ||
  process.env.PUSH_REMINDER_CRON_SECRET?.trim() ||
  randomUUID();

/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    root: process.cwd()
  }
};

export default nextConfig;
