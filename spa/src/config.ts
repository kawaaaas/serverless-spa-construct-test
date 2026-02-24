/**
 * Configuration for the SPA demo.
 * Update these values after deploying the CDK stack.
 *
 * When deployed behind CloudFront, API_BASE_URL should be '' (relative path).
 * For local development, set it to the API Gateway URL directly.
 */
export const config = {
  /** Cognito User Pool ID (e.g., 'ap-northeast-1_XXXXXXXXX') */
  USER_POOL_ID: 'YOUR_USER_POOL_ID',

  /** Cognito User Pool Client ID */
  USER_POOL_CLIENT_ID: 'YOUR_USER_POOL_CLIENT_ID',

  /** API base URL (leave empty when served via CloudFront) */
  API_BASE_URL: '',
} as const;
