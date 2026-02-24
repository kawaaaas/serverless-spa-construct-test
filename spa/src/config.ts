/**
 * Configuration for the SPA demo.
 * Values are injected at build time via environment variables (VITE_*).
 *
 * When deployed behind CloudFront, API_BASE_URL should be '' (relative path).
 * For local development, set it to the API Gateway URL directly.
 */
export const config = {
  /** Cognito User Pool ID (e.g., 'ap-northeast-1_XXXXXXXXX') */
  USER_POOL_ID: import.meta.env.VITE_USER_POOL_ID ?? '',

  /** Cognito User Pool Client ID */
  USER_POOL_CLIENT_ID: import.meta.env.VITE_USER_POOL_CLIENT_ID ?? '',

  /** API base URL (leave empty when served via CloudFront) */
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? '',
} as const;
