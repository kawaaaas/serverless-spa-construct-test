import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || '';
const COUNTER_ID = 'api-invocation-counter';

/**
 * Lambda handler for API Gateway proxy integration.
 * Counts invocations in DynamoDB and returns the count.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get current count
    const getResponse = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: COUNTER_ID,
          SK: COUNTER_ID,
        },
      })
    );

    const currentCount = getResponse.Item?.count || 0;
    const newCount = currentCount + 1;

    // Update count
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: COUNTER_ID,
          SK: COUNTER_ID,
          count: newCount,
          lastInvoked: new Date().toISOString(),
        },
      })
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Hello from Lambda!',
        path: event.path,
        method: event.httpMethod,
        invocationCount: newCount,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error accessing DynamoDB:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Error accessing database',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
