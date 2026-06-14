export const parasailConfig = {
  baseUrl:
    process.env.NEXT_PUBLIC_SPEEDBOAT_API_BASE_PATH?.replace(/\/$/, "") ??
    "/api/parasail",
  apiKey: process.env.NEXT_PUBLIC_PARASAIL_API_KEY
};
