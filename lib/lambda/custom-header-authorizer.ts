import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import {
  APIGatewayAuthorizerResult,
  APIGatewayRequestAuthorizerEvent,
  APIGatewayRequestAuthorizerHandler,
} from 'aws-lambda';

/**
 * Secret cache structure for storing secret values with TTL.
 */
interface SecretCache {
  value: string;
  expiresAt: number;
}

/**
 * Secret value structure stored in Secrets Manager.
 */
interface SecretValue {
  headerName: string;
  headerValue: string;
}

/**
 * JWT verifier instance for Cognito token validation.
 * Initialized lazily when needed.
 */
let jwtVerifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

/**
 * Default cache TTL in seconds (5 minutes).
 */
const DEFAULT_CACHE_TTL_SECONDS = 300;

/**
 * In-memory cache for secret values.
 * Persists across Lambda invocations within the same execution context.
 */
let secretCache: SecretCache | null = null;

/**
 * Secrets Manager client.
 * Uses the local region (ap-northeast-1) to access the replica.
 */
const secretsManager = new SecretsManagerClient({});

/**
 * Gets the secret ARN from environment variables.
 */
function getSecretArn(): string {
  const secretArn = process.env.SECRET_ARN;
  if (!secretArn) {
    throw new Error('SECRET_ARN environment variable is not set');
  }
  return secretArn;
}

/**
 * Gets the custom header name from environment variables.
 */
function getCustomHeaderName(): string {
  return process.env.CUSTOM_HEADER_NAME || 'x-origin-verify';
}

/**
 * Gets the Cognito User Pool ID from environment variables.
 */
function getUserPoolId(): string | undefined {
  return process.env.USER_POOL_ID;
}

/**
 * Gets the Cognito User Pool Client ID from environment variables.
 */
function getClientId(): string | undefined {
  return process.env.CLIENT_ID;
}

/**
 * Gets the cache TTL from environment variables.
 */
function getCacheTtlSeconds(): number {
  const ttl = process.env.CACHE_TTL_SECONDS;
  return ttl ? parseInt(ttl, 10) : DEFAULT_CACHE_TTL_SECONDS;
}

/**
 * Checks if the cache is valid (not expired).
 */
export function isCacheValid(cache: SecretCache | null, currentTime: number): boolean {
  if (!cache) {
    return false;
  }
  return currentTime < cache.expiresAt;
}

/**
 * Creates a new cache entry with the given value and TTL.
 */
export function createCacheEntry(
  value: string,
  ttlSeconds: number,
  currentTime: number
): SecretCache {
  return {
    value,
    expiresAt: currentTime + ttlSeconds * 1000,
  };
}

/**
 * Retrieves the secret value from Secrets Manager.
 */
async function fetchSecretValue(secretArn: string): Promise<SecretValue> {
  const response = await secretsManager.send(
    new GetSecretValueCommand({
      SecretId: secretArn,
    })
  );

  if (!response.SecretString) {
    throw new Error('Secret value is empty');
  }

  const secretValue = JSON.parse(response.SecretString) as SecretValue;

  if (!secretValue.headerValue) {
    throw new Error('Secret does not contain headerValue');
  }

  return secretValue;
}

/**
 * Gets the secret value, using cache if available and valid.
 */
async function getSecretValue(): Promise<string> {
  const currentTime = Date.now();
  const cacheTtl = getCacheTtlSeconds();

  // Check if cache is valid
  if (isCacheValid(secretCache, currentTime)) {
    console.log('Using cached secret value');
    return secretCache!.value;
  }

  // Fetch new secret value
  console.log('Fetching secret value from Secrets Manager');
  const secretArn = getSecretArn();
  const secretValue = await fetchSecretValue(secretArn);

  // Update cache
  secretCache = createCacheEntry(secretValue.headerValue, cacheTtl, currentTime);
  console.log('Secret value cached');

  return secretValue.headerValue;
}

/**
 * Generates an IAM policy document for API Gateway authorization.
 */
export function generatePolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  };
}

/**
 * Extracts the custom header value from the request headers.
 * Headers are case-insensitive, so we normalize to lowercase.
 */
export function extractHeaderValue(
  headers: { [key: string]: string | undefined } | null | undefined,
  headerName: string
): string | undefined {
  if (!headers) {
    return undefined;
  }

  const normalizedHeaderName = headerName.toLowerCase();

  // API Gateway may pass headers with various casing
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === normalizedHeaderName) {
      return value;
    }
  }

  return undefined;
}

/**
 * Validates the custom header value against the expected secret value.
 */
export function validateHeaderValue(
  actualValue: string | undefined,
  expectedValue: string
): boolean {
  if (!actualValue) {
    return false;
  }
  return actualValue === expectedValue;
}

/**
 * Extracts the JWT token from the Authorization header.
 * Supports both "Bearer <token>" and raw token formats.
 */
export function extractJwtToken(
  headers: { [key: string]: string | undefined } | null | undefined
): string | undefined {
  if (!headers) {
    return undefined;
  }

  // Look for Authorization header (case-insensitive)
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'authorization' && value) {
      // Remove "Bearer " prefix if present
      const bearerPrefix = 'Bearer ';
      if (value.startsWith(bearerPrefix)) {
        return value.substring(bearerPrefix.length);
      }
      return value;
    }
  }

  return undefined;
}

/**
 * Initializes the JWT verifier for Cognito token validation.
 */
function getJwtVerifier(): ReturnType<typeof CognitoJwtVerifier.create> {
  if (!jwtVerifier) {
    const userPoolId = getUserPoolId();
    const clientId = getClientId();

    if (!userPoolId || !clientId) {
      throw new Error('USER_POOL_ID and CLIENT_ID must be set for JWT validation');
    }

    jwtVerifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: 'access',
      clientId,
    });
  }

  return jwtVerifier;
}

/**
 * Validates the JWT token from Cognito User Pool.
 * Returns the decoded token payload if valid, or null if invalid.
 */
export async function validateJwtToken(token: string): Promise<unknown | null> {
  try {
    const verifier = getJwtVerifier();
    const payload = await verifier.verify(token);
    console.log('JWT token validated successfully');
    return payload;
  } catch (error) {
    console.error('JWT validation failed:', error);
    return null;
  }
}

/**
 * Lambda Authorizer handler for API Gateway.
 *
 * This handler performs two types of validation:
 * 1. Custom header validation (if SECRET_ARN is provided)
 *    - Checks for the presence of the custom header
 *    - Retrieves the expected secret value from Secrets Manager (with caching)
 *    - Validates the header value against the secret
 * 2. JWT validation (if USER_POOL_ID and CLIENT_ID are provided)
 *    - Extracts JWT token from Authorization header
 *    - Validates the token against Cognito User Pool
 *
 * Both validations must pass if both are configured.
 * The custom header is set by Lambda@Edge at CloudFront Origin Request.
 * This ensures that only requests coming through CloudFront with valid JWT are allowed.
 */
export const handler: APIGatewayRequestAuthorizerHandler = async (
  event: APIGatewayRequestAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  const customHeaderName = getCustomHeaderName();
  const methodArn = event.methodArn;
  const userPoolId = getUserPoolId();
  const clientId = getClientId();

  console.log(`Authorizing request for ${methodArn}`);

  try {
    let principalId = 'user';

    // 1. Custom header validation (if SECRET_ARN is configured)
    const secretArn = process.env.SECRET_ARN;
    if (secretArn) {
      console.log('Validating custom header');

      // Extract custom header value from request
      const headerValue = extractHeaderValue(event.headers, customHeaderName);

      if (!headerValue) {
        console.log(`Custom header ${customHeaderName} not found in request`);
        return generatePolicy('unauthorized', 'Deny', methodArn);
      }

      // Get expected secret value (from cache or Secrets Manager)
      const expectedValue = await getSecretValue();

      // Validate header value
      if (!validateHeaderValue(headerValue, expectedValue)) {
        console.log(`Custom header ${customHeaderName} value is invalid`);
        return generatePolicy('unauthorized', 'Deny', methodArn);
      }

      console.log('Custom header validated successfully');
      principalId = 'cloudfront';
    }

    // 2. JWT validation (if USER_POOL_ID and CLIENT_ID are configured)
    if (userPoolId && clientId) {
      console.log('Validating JWT token');

      // Extract JWT token from Authorization header
      const jwtToken = extractJwtToken(event.headers);

      if (!jwtToken) {
        console.log('JWT token not found in Authorization header');
        return generatePolicy('unauthorized', 'Deny', methodArn);
      }

      // Validate JWT token
      const payload = await validateJwtToken(jwtToken);

      if (!payload) {
        console.log('JWT token validation failed');
        return generatePolicy('unauthorized', 'Deny', methodArn);
      }

      console.log('JWT token validated successfully');
      // Use sub (subject) from JWT as principal ID if available
      if (typeof payload === 'object' && payload !== null && 'sub' in payload) {
        principalId = String(payload.sub);
      }
    }

    console.log('Request authorized successfully');
    return generatePolicy(principalId, 'Allow', methodArn);
  } catch (error) {
    // Log error and deny access
    console.error('Authorization failed:', error);
    return generatePolicy('error', 'Deny', methodArn);
  }
};

/**
 * Clears the secret cache.
 * Exported for testing purposes.
 */
export function clearCache(): void {
  secretCache = null;
}

/**
 * Gets the current cache state.
 * Exported for testing purposes.
 */
export function getCache(): SecretCache | null {
  return secretCache;
}

/**
 * Sets the cache directly.
 * Exported for testing purposes.
 */
export function setCache(cache: SecretCache | null): void {
  secretCache = cache;
}
