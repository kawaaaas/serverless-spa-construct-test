import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import {
  CloudFrontRequestEvent,
  CloudFrontRequestHandler,
  CloudFrontRequestResult,
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
 * Default cache TTL in seconds (5 minutes).
 */
const DEFAULT_CACHE_TTL_SECONDS = 300;

/**
 * In-memory cache for secret values.
 * Persists across Lambda invocations within the same execution context.
 */
let secretCache: SecretCache | null = null;

/**
 * Gets the Secrets Manager region from build-time configuration.
 * Defaults to 'us-east-1' where the secret is stored.
 */
function getSecretRegion(): string {
  return process.env.SECRET_REGION || 'us-east-1';
}

/**
 * Secrets Manager client.
 * Lambda@Edge runs at edge locations worldwide, so we must explicitly
 * specify us-east-1 where the secret is stored.
 * Initialized lazily to ensure build-time define values are resolved.
 *
 * Note: We use an explicit endpoint URL in addition to the region option
 * because the Lambda@Edge runtime SDK may ignore the region parameter
 * and fall back to AWS_REGION (the edge location's region), causing
 * cross-region AccessDeniedException errors.
 */
let _secretsManager: SecretsManagerClient | null = null;

function getSecretsManagerClient(): SecretsManagerClient {
  if (!_secretsManager) {
    const region = getSecretRegion();
    _secretsManager = new SecretsManagerClient({
      region,
      endpoint: `https://secretsmanager.${region}.amazonaws.com`,
    });
  }
  return _secretsManager;
}

/**
 * Gets the secret name from environment variables.
 * The secret name is used directly with Secrets Manager (not ARN).
 */
function getSecretName(): string {
  const secretName = process.env.SECRET_NAME;
  if (!secretName) {
    throw new Error('SECRET_NAME environment variable is not set');
  }
  return secretName;
}

/**
 * Gets the custom header name from environment variables.
 */
function getCustomHeaderName(): string {
  return process.env.CUSTOM_HEADER_NAME || 'x-origin-verify';
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
 * Uses secret name directly (not ARN).
 */
async function fetchSecretValue(secretName: string): Promise<SecretValue> {
  const response = await getSecretsManagerClient().send(
    new GetSecretValueCommand({
      SecretId: secretName,
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
  const secretName = getSecretName();
  const secretValue = await fetchSecretValue(secretName);

  // Update cache
  secretCache = createCacheEntry(secretValue.headerValue, cacheTtl, currentTime);
  console.log('Secret value cached');

  return secretValue.headerValue;
}

/**
 * Creates a 403 Forbidden response.
 */
function createForbiddenResponse(message: string): CloudFrontRequestResult {
  return {
    status: '403',
    statusDescription: 'Forbidden',
    headers: {
      'content-type': [{ key: 'Content-Type', value: 'application/json' }],
    },
    body: JSON.stringify({ error: message }),
  };
}

/**
 * Adds custom header to the request.
 */
export function addCustomHeader(
  request: CloudFrontRequestEvent['Records'][0]['cf']['request'],
  headerName: string,
  headerValue: string
): CloudFrontRequestEvent['Records'][0]['cf']['request'] {
  // CloudFront headers use lowercase keys
  const normalizedHeaderName = headerName.toLowerCase();

  request.headers[normalizedHeaderName] = [
    {
      key: headerName,
      value: headerValue,
    },
  ];

  return request;
}

/**
 * Lambda@Edge handler for CloudFront Origin Request.
 *
 * This handler:
 * 1. Retrieves the secret value from Secrets Manager (with caching)
 * 2. Adds the secret value as a custom header to the request
 * 3. Returns 403 if unable to retrieve the secret
 *
 * The custom header is used by API Gateway's Lambda Authorizer
 * to verify that requests come through CloudFront.
 */
export const handler: CloudFrontRequestHandler = async (
  event: CloudFrontRequestEvent
): Promise<CloudFrontRequestResult> => {
  const request = event.Records[0].cf.request;
  const customHeaderName = getCustomHeaderName();

  try {
    // Get secret value (from cache or Secrets Manager)
    const secretValue = await getSecretValue();

    // Add custom header to request
    addCustomHeader(request, customHeaderName, secretValue);

    console.log(`Added custom header ${customHeaderName} to request`);
    return request;
  } catch (error) {
    // Log error and return 403
    console.error('Failed to process request:', error);
    return createForbiddenResponse('Access denied');
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
