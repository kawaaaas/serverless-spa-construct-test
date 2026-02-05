import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { RestApi } from 'aws-cdk-lib/aws-apigateway';
import { FrontendConstruct } from '../../lib/constructs/frontend-construct';

describe('FrontendConstruct', () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
  });

  describe('S3 Bucket', () => {
    test('creates S3 bucket', () => {
      new FrontendConstruct(stack, 'Frontend');

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::S3::Bucket', 1);
    });

    test('blocks public access', () => {
      new FrontendConstruct(stack, 'Frontend');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::S3::Bucket', {
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    });

    test('sets RemovalPolicy.DESTROY', () => {
      new FrontendConstruct(stack, 'Frontend');

      const template = Template.fromStack(stack);
      template.hasResource('AWS::S3::Bucket', {
        DeletionPolicy: 'Delete',
        UpdateReplacePolicy: 'Delete',
      });
    });

    test('enables autoDeleteObjects', () => {
      new FrontendConstruct(stack, 'Frontend');

      const template = Template.fromStack(stack);
      // autoDeleteObjects creates a custom resource for bucket cleanup
      template.resourceCountIs('Custom::S3AutoDeleteObjects', 1);
    });
  });

  describe('CloudFront Distribution', () => {
    test('creates CloudFront distribution', () => {
      new FrontendConstruct(stack, 'Frontend');

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    });

    test('creates OAC and associates with distribution', () => {
      new FrontendConstruct(stack, 'Frontend');

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
      template.hasResourceProperties('AWS::CloudFront::OriginAccessControl', {
        OriginAccessControlConfig: {
          OriginAccessControlOriginType: 's3',
          SigningBehavior: 'always',
          SigningProtocol: 'sigv4',
        },
      });
    });

    test('sets PriceClass.PRICE_CLASS_100', () => {
      new FrontendConstruct(stack, 'Frontend');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          PriceClass: 'PriceClass_100',
        },
      });
    });

    test('sets error responses for 403 and 404', () => {
      new FrontendConstruct(stack, 'Frontend');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          CustomErrorResponses: Match.arrayWith([
            Match.objectLike({
              ErrorCode: 403,
              ResponseCode: 200,
              ResponsePagePath: '/index.html',
            }),
            Match.objectLike({
              ErrorCode: 404,
              ResponseCode: 200,
              ResponsePagePath: '/index.html',
            }),
          ]),
        },
      });
    });

    test('sets defaultRootObject to index.html', () => {
      new FrontendConstruct(stack, 'Frontend');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          DefaultRootObject: 'index.html',
        },
      });
    });
  });

  describe('CloudFront Function', () => {
    test('creates CloudFront Function', () => {
      new FrontendConstruct(stack, 'Frontend');

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::CloudFront::Function', 1);
    });

    test('associates CloudFront Function with default behavior', () => {
      new FrontendConstruct(stack, 'Frontend');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          DefaultCacheBehavior: {
            FunctionAssociations: Match.arrayWith([
              Match.objectLike({
                EventType: 'viewer-request',
              }),
            ]),
          },
        },
      });
    });
  });

  describe('API Gateway Routing', () => {
    // Helper function to create a valid RestApi with at least one method
    const createValidRestApi = () => {
      const api = new RestApi(stack, 'TestApi');
      api.root.addMethod('GET'); // RestApi requires at least one method
      return api;
    };

    test('adds /api/* behavior when api is provided', () => {
      const api = createValidRestApi();
      new FrontendConstruct(stack, 'Frontend', { api });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          CacheBehaviors: Match.arrayWith([
            Match.objectLike({
              PathPattern: '/api/*',
            }),
          ]),
        },
      });
    });

    test('does not add /api/* behavior when api is not provided', () => {
      new FrontendConstruct(stack, 'Frontend');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          CacheBehaviors: Match.absent(),
        },
      });
    });

    test('sets custom header on API Gateway origin', () => {
      const api = createValidRestApi();
      new FrontendConstruct(stack, 'Frontend', {
        api,
        customHeaderName: 'x-test-header',
        customHeaderSecret: 'test-secret',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          Origins: Match.arrayWith([
            Match.objectLike({
              CustomOriginConfig: Match.anyValue(),
              OriginCustomHeaders: Match.arrayWith([
                Match.objectLike({
                  HeaderName: 'x-test-header',
                  HeaderValue: 'test-secret',
                }),
              ]),
            }),
          ]),
        },
      });
    });

    test('disables caching for API Gateway behavior', () => {
      const api = createValidRestApi();
      new FrontendConstruct(stack, 'Frontend', { api });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          CacheBehaviors: Match.arrayWith([
            Match.objectLike({
              PathPattern: '/api/*',
              CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad', // CACHING_DISABLED policy ID
            }),
          ]),
        },
      });
    });
  });

  describe('Custom Header', () => {
    // Helper function to create a valid RestApi with at least one method
    const createValidRestApi = () => {
      const api = new RestApi(stack, 'TestApi');
      api.root.addMethod('GET'); // RestApi requires at least one method
      return api;
    };

    test('uses default custom header name when api is provided', () => {
      const api = createValidRestApi();
      const frontend = new FrontendConstruct(stack, 'Frontend', { api });

      expect(frontend.customHeaderName).toBe('x-origin-verify');
    });

    test('uses custom header name when provided', () => {
      const api = createValidRestApi();
      const frontend = new FrontendConstruct(stack, 'Frontend', {
        api,
        customHeaderName: 'x-custom-header',
      });

      expect(frontend.customHeaderName).toBe('x-custom-header');
    });

    test('generates custom header secret when not provided', () => {
      const api = createValidRestApi();
      const frontend = new FrontendConstruct(stack, 'Frontend', { api });

      expect(frontend.customHeaderSecret).toBeDefined();
      expect(typeof frontend.customHeaderSecret).toBe('string');
      expect(frontend.customHeaderSecret!.length).toBeGreaterThan(0);
    });

    test('uses custom header secret when provided', () => {
      const api = createValidRestApi();
      const frontend = new FrontendConstruct(stack, 'Frontend', {
        api,
        customHeaderSecret: 'my-secret-value',
      });

      expect(frontend.customHeaderSecret).toBe('my-secret-value');
    });

    test('does not set custom header properties when api is not provided', () => {
      const frontend = new FrontendConstruct(stack, 'Frontend');

      expect(frontend.customHeaderName).toBeUndefined();
      expect(frontend.customHeaderSecret).toBeUndefined();
    });
  });

  describe('Props Override', () => {
    test('overrides bucket props', () => {
      new FrontendConstruct(stack, 'Frontend', {
        bucketProps: {
          versioned: true,
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::S3::Bucket', {
        VersioningConfiguration: {
          Status: 'Enabled',
        },
      });
    });

    test('overrides distribution props', () => {
      new FrontendConstruct(stack, 'Frontend', {
        distributionProps: {
          comment: 'Custom distribution comment',
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          Comment: 'Custom distribution comment',
        },
      });
    });
  });

  describe('Output Properties', () => {
    test('exposes bucket property', () => {
      const frontend = new FrontendConstruct(stack, 'Frontend');

      expect(frontend.bucket).toBeDefined();
    });

    test('exposes distribution property', () => {
      const frontend = new FrontendConstruct(stack, 'Frontend');

      expect(frontend.distribution).toBeDefined();
    });

    test('exposes distributionDomainName property', () => {
      const frontend = new FrontendConstruct(stack, 'Frontend');

      expect(frontend.distributionDomainName).toBeDefined();
      expect(typeof frontend.distributionDomainName).toBe('string');
    });

    test('exposes customHeaderName when api is provided', () => {
      const api = new RestApi(stack, 'TestApi');
      api.root.addMethod('GET'); // RestApi requires at least one method
      const frontend = new FrontendConstruct(stack, 'Frontend', { api });

      expect(frontend.customHeaderName).toBeDefined();
      expect(typeof frontend.customHeaderName).toBe('string');
    });

    test('exposes customHeaderSecret when api is provided', () => {
      const api = new RestApi(stack, 'TestApi');
      api.root.addMethod('GET'); // RestApi requires at least one method
      const frontend = new FrontendConstruct(stack, 'Frontend', { api });

      expect(frontend.customHeaderSecret).toBeDefined();
      expect(typeof frontend.customHeaderSecret).toBe('string');
    });
  });
});
