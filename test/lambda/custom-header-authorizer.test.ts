import * as fc from 'fast-check';
import {
  clearCache,
  createCacheEntry,
  extractHeaderValue,
  generatePolicy,
  isCacheValid,
  validateHeaderValue,
} from '../../lib/lambda/custom-header-authorizer';

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
 * Arbitrary for generating valid header values (secret values).
 * Header values should be non-empty strings without control characters.
 */
const headerValueArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')), {
    minLength: 1,
    maxLength: 64,
  })
  .map((chars: string[]) => chars.join(''));

/**
 * Arbitrary for generating method ARNs.
 */
const methodArnArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom('us-east-1', 'ap-northeast-1', 'eu-west-1'),
    fc.stringMatching(/^[0-9]{12}$/),
    fc.stringMatching(/^[a-z0-9]{10}$/),
    fc.constantFrom('prod', 'dev', 'staging'),
    fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
    fc.stringMatching(/^\/[a-z]+$/)
  )
  .map(
    ([region, accountId, apiId, stage, method, path]) =>
      `arn:aws:execute-api:${region}:${accountId}:${apiId}/${stage}/${method}${path}`
  );

describe('Lambda Authorizer Handler', () => {
  beforeEach(() => {
    clearCache();
  });

  describe('Property 2: Lambda Authorizer Authorization Decision', () => {
    /**
     * **Property 2: Lambda Authorizer認可判定**
     *
     * For any API Gateway request and secret value,
     * when the request header contains the correct custom header value,
     * an Allow policy shall be returned.
     * When the header is missing or has an incorrect value,
     * a Deny policy shall be returned.
     *
     * **Validates: Requirements 3.4, 3.5, 3.6**
     */

    /**
     * Property: validateHeaderValue returns true when values match exactly.
     *
     * **Validates: Requirements 3.4**
     */
    test('validateHeaderValue returns true when actual value matches expected value', () => {
      fc.assert(
        fc.property(headerValueArb, (secretValue: string) => {
          // Act & Assert
          expect(validateHeaderValue(secretValue, secretValue)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: validateHeaderValue returns false when values do not match.
     *
     * **Validates: Requirements 3.6**
     */
    test('validateHeaderValue returns false when actual value does not match expected value', () => {
      fc.assert(
        fc.property(
          headerValueArb,
          headerValueArb.filter((v) => v.length > 0),
          (actualValue: string, expectedValue: string) => {
            // Only test when values are different
            fc.pre(actualValue !== expectedValue);

            // Act & Assert
            expect(validateHeaderValue(actualValue, expectedValue)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: validateHeaderValue returns false when actual value is undefined.
     *
     * **Validates: Requirements 3.5**
     */
    test('validateHeaderValue returns false when actual value is undefined', () => {
      fc.assert(
        fc.property(headerValueArb, (expectedValue: string) => {
          // Act & Assert
          expect(validateHeaderValue(undefined, expectedValue)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: extractHeaderValue returns the correct value when header exists.
     *
     * **Validates: Requirements 3.4**
     */
    test('extractHeaderValue returns value when header exists (case-insensitive)', () => {
      fc.assert(
        fc.property(headerNameArb, headerValueArb, (headerName: string, headerValue: string) => {
          // Arrange - test with various casings
          const headers = { [headerName]: headerValue };

          // Act
          const result = extractHeaderValue(headers, headerName);

          // Assert
          expect(result).toBe(headerValue);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: extractHeaderValue returns undefined when header does not exist.
     *
     * **Validates: Requirements 3.5**
     */
    test('extractHeaderValue returns undefined when header does not exist', () => {
      fc.assert(
        fc.property(
          headerNameArb,
          headerNameArb,
          headerValueArb,
          (searchName, existingName, existingValue) => {
            // Only test when names are different
            fc.pre(searchName.toLowerCase() !== existingName.toLowerCase());

            // Arrange
            const headers = { [existingName]: existingValue };

            // Act
            const result = extractHeaderValue(headers, searchName);

            // Assert
            expect(result).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: extractHeaderValue returns undefined when headers is null or undefined.
     *
     * **Validates: Requirements 3.5**
     */
    test('extractHeaderValue returns undefined when headers is null or undefined', () => {
      fc.assert(
        fc.property(headerNameArb, (headerName: string) => {
          // Act & Assert
          expect(extractHeaderValue(null, headerName)).toBeUndefined();
          expect(extractHeaderValue(undefined, headerName)).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: generatePolicy creates Allow policy with correct structure.
     *
     * **Validates: Requirements 3.4**
     */
    test('generatePolicy creates Allow policy with correct structure', () => {
      fc.assert(
        fc.property(methodArnArb, (methodArn: string) => {
          // Act
          const result = generatePolicy('cloudfront', 'Allow', methodArn);

          // Assert
          expect(result.principalId).toBe('cloudfront');
          expect(result.policyDocument.Version).toBe('2012-10-17');
          expect(result.policyDocument.Statement).toHaveLength(1);
          const statement = result.policyDocument.Statement[0] as {
            Action: string;
            Effect: string;
            Resource: string;
          };
          expect(statement.Effect).toBe('Allow');
          expect(statement.Action).toBe('execute-api:Invoke');
          expect(statement.Resource).toBe(methodArn);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: generatePolicy creates Deny policy with correct structure.
     *
     * **Validates: Requirements 3.5, 3.6**
     */
    test('generatePolicy creates Deny policy with correct structure', () => {
      fc.assert(
        fc.property(methodArnArb, (methodArn: string) => {
          // Act
          const result = generatePolicy('unauthorized', 'Deny', methodArn);

          // Assert
          expect(result.principalId).toBe('unauthorized');
          expect(result.policyDocument.Version).toBe('2012-10-17');
          expect(result.policyDocument.Statement).toHaveLength(1);
          const statement = result.policyDocument.Statement[0] as {
            Action: string;
            Effect: string;
            Resource: string;
          };
          expect(statement.Effect).toBe('Deny');
          expect(statement.Action).toBe('execute-api:Invoke');
          expect(statement.Resource).toBe(methodArn);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Header extraction is case-insensitive.
     *
     * **Validates: Requirements 3.4**
     */
    test('extractHeaderValue is case-insensitive for header names', () => {
      fc.assert(
        fc.property(headerValueArb, (headerValue: string) => {
          // Arrange - use mixed case header name
          const headers = { 'X-Origin-Verify': headerValue };

          // Act & Assert - should find with any casing
          expect(extractHeaderValue(headers, 'x-origin-verify')).toBe(headerValue);
          expect(extractHeaderValue(headers, 'X-ORIGIN-VERIFY')).toBe(headerValue);
          expect(extractHeaderValue(headers, 'X-Origin-Verify')).toBe(headerValue);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Cache Behavior for Lambda Authorizer', () => {
    /**
     * Property: Cache is valid when current time is before expiration.
     *
     * **Validates: Requirements 3.7, 7.2**
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
     * **Validates: Requirements 3.7, 7.2**
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
     * **Validates: Requirements 3.7**
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
     * **Validates: Requirements 7.2**
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
  });
});
