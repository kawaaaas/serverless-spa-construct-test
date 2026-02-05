import {
  DescribeSecretCommand,
  GetSecretValueCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { PutParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { SecretsManagerRotationEvent, SecretsManagerRotationHandler } from 'aws-lambda';
import { randomUUID } from 'crypto';

const secretsManager = new SecretsManagerClient({});
const ssm = new SSMClient({});

/**
 * Secrets Manager rotation handler for custom header values.
 *
 * This Lambda function handles the rotation of custom header secrets:
 * 1. Creates a new UUID value for the header
 * 2. Updates the secret in Secrets Manager
 * 3. Updates the corresponding SSM parameter
 *
 * The rotation follows the standard Secrets Manager rotation steps:
 * - createSecret: Generate new secret value
 * - setSecret: Not used (no external service to update)
 * - testSecret: Not used (no external service to test)
 * - finishSecret: Mark the new version as current
 */
export const handler: SecretsManagerRotationHandler = async (
  event: SecretsManagerRotationEvent
): Promise<void> => {
  const { SecretId, ClientRequestToken, Step } = event;
  const ssmPrefix = process.env.SSM_PREFIX || '/myapp/security/';
  const customHeaderName = process.env.CUSTOM_HEADER_NAME || 'x-origin-verify';

  console.log(`Processing rotation step: ${Step} for secret: ${SecretId}`);

  switch (Step) {
    case 'createSecret':
      await createSecret(SecretId, ClientRequestToken, customHeaderName);
      break;
    case 'setSecret':
      // No external service to update
      console.log('setSecret step - no action needed');
      break;
    case 'testSecret':
      // No external service to test
      console.log('testSecret step - no action needed');
      break;
    case 'finishSecret':
      await finishSecret(SecretId, ClientRequestToken, ssmPrefix);
      break;
    default:
      throw new Error(`Unknown rotation step: ${Step}`);
  }
};

/**
 * Creates a new secret version with a new UUID value.
 */
async function createSecret(
  secretId: string,
  clientRequestToken: string,
  customHeaderName: string
): Promise<void> {
  // Check if the secret version already exists
  try {
    await secretsManager.send(
      new GetSecretValueCommand({
        SecretId: secretId,
        VersionId: clientRequestToken,
        VersionStage: 'AWSPENDING',
      })
    );
    console.log('Secret version already exists, skipping creation');
    return;
  } catch {
    // Secret version doesn't exist, create it
  }

  // Generate new UUID value
  const newHeaderValue = randomUUID();
  const secretValue = JSON.stringify({
    headerName: customHeaderName,
    headerValue: newHeaderValue,
  });

  // Create new secret version
  await secretsManager.send(
    new PutSecretValueCommand({
      SecretId: secretId,
      ClientRequestToken: clientRequestToken,
      SecretString: secretValue,
      VersionStages: ['AWSPENDING'],
    })
  );

  console.log('Created new secret version with new UUID');
}

/**
 * Finishes the rotation by marking the new version as current
 * and updating SSM parameters.
 */
async function finishSecret(
  secretId: string,
  clientRequestToken: string,
  ssmPrefix: string
): Promise<void> {
  // Get the secret metadata to find the current version
  const describeResponse = await secretsManager.send(
    new DescribeSecretCommand({
      SecretId: secretId,
    })
  );

  // Check if the pending version is already current
  const versions = describeResponse.VersionIdsToStages || {};
  const pendingStages = versions[clientRequestToken] as string[] | undefined;
  if (pendingStages?.includes('AWSCURRENT')) {
    console.log('Secret version is already current');
    return;
  }

  // Find the current version to demote
  let currentVersion: string | undefined;
  for (const [versionId, stages] of Object.entries(versions)) {
    const stageList = stages as string[] | undefined;
    if (stageList?.includes('AWSCURRENT') && versionId !== clientRequestToken) {
      currentVersion = versionId;
      break;
    }
  }

  // Move AWSCURRENT to the new version
  const stagingLabels = ['AWSCURRENT'];
  if (currentVersion) {
    // The SDK will automatically remove AWSCURRENT from the old version
  }

  await secretsManager.send(
    new PutSecretValueCommand({
      SecretId: secretId,
      ClientRequestToken: clientRequestToken,
      VersionStages: stagingLabels,
    })
  );

  // Update SSM parameter with the secret ARN (for cross-region reference)
  // Note: The secret ARN doesn't change, but we update the parameter
  // to ensure consistency and trigger any dependent resources
  await ssm.send(
    new PutParameterCommand({
      Name: `${ssmPrefix}secret-arn`,
      Value: describeResponse.ARN || secretId,
      Type: 'String',
      Overwrite: true,
    })
  );

  console.log('Finished rotation and updated SSM parameter');
}
