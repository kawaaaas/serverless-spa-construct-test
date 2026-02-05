import { CloudFrontRequestEvent } from 'aws-lambda';
import * as fc from 'fast-check';
import {
  addCustomHeader,
  clearCache,
  createCacheEntry,
  isCacheValid,
} from '../../lib/lambda/edge-origin-request';

/**
 * Creates a mock CloudFront request for testing.
 */
function createMockRequest(): CloudFrontRequestEvent['Records'][0]['cf']['request'] {
  return {
    clientIp: '1.2.3.4',
    method: 'GET',
    uri: '/api/test',
    querystring: '',
    headers: {},
    origin: {
      custom: {
        domainName: 'api.example.com',
        port: 443,
        protocol: 'https',
        path: '',
        sslProtocols: ['TLSv1.2'],
        readTimeout: 30,
        keepaliveTimeout: 5,
        customHeaders: {},
      },
    },
  };
}

/**
 * Arbitrary for generating valid header names.
 * Header names should be alphanumeric with hyphens, starting with x-.
 */
const headerNameArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), {
    minLength: 1,
    maxLength: 20,
  })
  .map((chars: string[]) => `x-${chars.join('')}`);

/**
 * Arbitrary for generating valid header values.
 * Header values should be non-empty strings without control characters.
 */
const headerValueArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')), {
    minLength: 1,
    maxLength: 64,
  })
  .map((chars: string[]) => chars.join(''));

describe('Lambda@Edge Origin Request Handler', () => {
  beforeEach(() => {
    clearCache();
  });

  describe('Property 1: Lambda@Edge Header Addition', () => {
    /**
     * **Property 1: Lambda@Edgeヘッダー付与**
     *
     * For any CloudFront Origin Request event and secret value,
     * when the Lambda@Edge function executes successfully,
     * the output request shall contain the specified custom header name
     * and secret value.
     *
     * **Validates: Requirements 2.3**
     */
    test('addCustomHeader always adds the specified header to the request', () => {
      fc.assert(
        fc.property(headerNameArb, headerValueArb, (headerName: string, headerValue: string) => {
          // Arrange
          const request = createMockRequest();

          // Act
          const result = addCustomHeader(request, headerName, headerValue);

          // Assert
          const normalizedHeaderName = headerName.toLowerCase();
          expect(result.headers[normalizedHeaderName]).toBeDefined();
          expect(result.headers[normalizedHeaderName]).toHaveLength(1);
          expect(result.headers[normalizedHeaderName][0].key).toBe(headerName);
          expect(result.headers[normalizedHeaderName][0].value).toBe(headerValue);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Header addition preserves existing headers.
     *
     * **Validates: Requirements 2.3**
     */
    test('addCustomHeader preserves existing headers', () => {
      const existingHeadersArb = fc.array(fc.tuple(headerNameArb, headerValueArb), {
        minLength: 1,
        maxLength: 5,
      });

      fc.assert(
        fc.property(
          headerNameArb,
          headerValueArb,
          existingHeadersArb,
          (newHeaderName: string, newHeaderValue: string, existingHeaders: [string, string][]) => {
            // Arrange
            const request = createMockRequest();

            // Add existing headers
            for (const [name, value] of existingHeaders) {
              const normalizedName = name.toLowerCase();
              request.headers[normalizedName] = [{ key: name, value }];
            }

            const existingHeaderCount = Object.keys(request.headers).length;

            // Act
            const result = addCustomHeader(request, newHeaderName, newHeaderValue);

            // Assert
            // The new header should be added
            const normalizedNewName = newHeaderName.toLowerCase();
            expect(result.headers[normalizedNewName]).toBeDefined();
            expect(result.headers[normalizedNewName][0].value).toBe(newHeaderValue);

            // Existing headers should be preserved (unless overwritten by same name)
            const expectedCount = existingHeaders.some(
              ([name]) => name.toLowerCase() === normalizedNewName
            )
              ? existingHeaderCount
              : existingHeaderCount + 1;
            expect(Object.keys(result.headers).length).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Header name is normalized to lowercase for CloudFront.
     *
     * **Validates: Requirements 2.3**
     */
    test('addCustomHeader normalizes header name to lowercase', () => {
      fc.assert(
        fc.property(headerValueArb, (headerValue: string) => {
          // Arrange
          const request = createMockRequest();
          const headerName = 'X-Origin-Verify';

          // Act
          const result = addCustomHeader(request, headerName, headerValue);

          // Assert
          expect(result.headers['x-origin-verify']).toBeDefined();
          expect(result.headers['x-origin-verify'][0].key).toBe(headerName);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Cache Behavior', () => {
    /**
     * **Property 3: キャッシュ動作**
     *
     * For any Lambda function and cache TTL,
     * while the cache is valid (current time < cache creation time + TTL),
     * the cached value shall be used.
     * After expiration, a new value shall be fetched from Secrets Manager.
     *
     * **Validates: Requirements 2.4, 2.5, 7.4**
     */
    test('isCacheValid returns true when current time is before expiration', () => {
      fc.assert(
        fc.property(
          headerValueArb,
          fc.integer({ min: 1, max: 3600 }), // TTL in seconds
          fc.integer({ min: 0, max: 1000000000000 }), // Base time
          fc.integer({ min: 0, max: 3600 }), // Time offset within TTL
          (value: string, ttlSeconds: number, baseTime: number, timeOffset: number) => {
            // Arrange
            const cache = createCacheEntry(value, ttlSeconds, baseTime);
            // Current time is within TTL
            const currentTime = baseTime + timeOffset * 1000;

            // Act & Assert
            if (currentTime < cache.expiresAt) {
              expect(isCacheValid(cache, currentTime)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Cache is invalid when current time is at or after expiration.
     *
     * **Validates: Requirements 2.5, 7.4**
     */
    test('isCacheValid returns false when current time is at or after expiration', () => {
      fc.assert(
        fc.property(
          headerValueArb,
          fc.integer({ min: 1, max: 3600 }), // TTL in seconds
          fc.integer({ min: 0, max: 1000000000000 }), // Base time
          fc.integer({ min: 0, max: 3600 }), // Time offset after TTL
          (value: string, ttlSeconds: number, baseTime: number, timeOffset: number) => {
            // Arrange
            const cache = createCacheEntry(value, ttlSeconds, baseTime);
            // Current time is at or after expiration
            const currentTime = cache.expiresAt + timeOffset * 1000;

            // Act & Assert
            expect(isCacheValid(cache, currentTime)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Cache is invalid when null.
     *
     * **Validates: Requirements 2.4**
     */
    test('isCacheValid returns false when cache is null', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 1000000000000 }), (currentTime: number) => {
          // Act & Assert
          expect(isCacheValid(null, currentTime)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: createCacheEntry creates cache with correct expiration time.
     *
     * **Validates: Requirements 7.1, 7.4**
     */
    test('createCacheEntry sets correct expiration time', () => {
      fc.assert(
        fc.property(
          headerValueArb,
          fc.integer({ min: 1, max: 3600 }), // TTL in seconds
          fc.integer({ min: 0, max: 1000000000000 }), // Current time
          (value: string, ttlSeconds: number, currentTime: number) => {
            // Act
            const cache = createCacheEntry(value, ttlSeconds, currentTime);

            // Assert
            expect(cache.value).toBe(value);
            expect(cache.expiresAt).toBe(currentTime + ttlSeconds * 1000);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Cache value is preserved correctly.
     *
     * **Validates: Requirements 7.1**
     */
    test('createCacheEntry preserves the secret value', () => {
      fc.assert(
        fc.property(
          headerValueArb,
          fc.integer({ min: 1, max: 3600 }),
          fc.integer({ min: 0, max: 1000000000000 }),
          (value: string, ttlSeconds: number, currentTime: number) => {
            // Act
            const cache = createCacheEntry(value, ttlSeconds, currentTime);

            // Assert
            expect(cache.value).toBe(value);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
