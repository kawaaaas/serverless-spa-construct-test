import { RestApi } from 'aws-cdk-lib/aws-apigateway';
import { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import {
  AllowedMethods,
  CachePolicy,
  Function as CloudFrontFunction,
  Distribution,
  DistributionProps,
  FunctionCode,
  FunctionEventType,
  IDistribution,
  LambdaEdgeEventType,
  OriginRequestPolicy,
  PriceClass,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { RestApiOrigin, S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { IVersion } from 'aws-cdk-lib/aws-lambda';
import { ARecord, HostedZone, IHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { BlockPublicAccess, Bucket, BucketProps, IBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

/**
 * Properties for FrontendConstruct.
 */
export interface FrontendConstructProps {
  /**
   * Optional API Gateway for /api/* routing.
   * If provided, requests to /api/* will be routed to this API Gateway.
   * Note: Requires RestApi (not IRestApi) to access the .url property for CloudFront origin.
   */
  readonly api?: RestApi;

  /**
   * Optional WAF WebACL ARN to associate with the CloudFront distribution.
   * Must be a WAF WebACL with CLOUDFRONT scope (deployed in us-east-1).
   */
  readonly webAclArn?: string;

  /**
   * Custom domain name for the CloudFront distribution.
   * If provided, certificate must also be provided.
   * @example 'www.example.com'
   */
  readonly domainName?: string;

  /**
   * Additional domain names (aliases) for the CloudFront distribution.
   * @example ['example.com', 'app.example.com']
   */
  readonly alternativeDomainNames?: string[];

  /**
   * ACM certificate for the custom domain.
   * Required when domainName is provided. Must be in us-east-1 region for CloudFront.
   * Use ServerlessSpaSecurityConstruct.withCertificate() or withWafAndCertificate()
   * to create a certificate in us-east-1, or provide an externally created certificate.
   */
  readonly certificate?: ICertificate;

  /**
   * Route53 hosted zone ID for creating DNS records and certificate validation.
   * Can be found in the Route53 console (e.g., 'Z1234567890ABC').
   * Required along with zoneName for automatic certificate creation and DNS record.
   */
  readonly hostedZoneId?: string;

  /**
   * Route53 hosted zone name (domain name).
   * Must match the zone name in Route53 (e.g., 'example.com').
   * Required along with hostedZoneId for automatic certificate creation and DNS record.
   */
  readonly zoneName?: string;

  /**
   * Custom header name for API Gateway access restriction.
   * Only used when api is provided.
   * @default 'x-origin-verify'
   */
  readonly customHeaderName?: string;

  /**
   * Additional S3 bucket properties to override defaults.
   * These will be merged with the default configuration.
   */
  readonly bucketProps?: Partial<BucketProps>;

  /**
   * Additional CloudFront distribution properties to override defaults.
   * These will be merged with the default configuration.
   */
  readonly distributionProps?: Partial<DistributionProps>;

  /**
   * Lambda@Edge function version for origin request.
   * When provided, static custom header configuration is disabled
   * and Lambda@Edge will dynamically add the custom header.
   * Must be deployed in us-east-1 region.
   */
  readonly edgeFunctionVersion?: IVersion;
}

/**
 * A CDK construct that creates an S3 bucket and CloudFront distribution for hosting SPAs.
 *
 * This construct provides:
 * - S3 bucket with public access blocked (CloudFront-only access via OAC)
 * - CloudFront distribution with SPA routing support via CloudFront Functions
 * - Optional API Gateway routing for /api/* paths
 * - Custom header support for API Gateway access restriction
 * - Optional custom domain with ACM certificate and Route53 DNS record
 */
export class FrontendConstruct extends Construct {
  /**
   * The S3 bucket created by this construct.
   */
  public readonly bucket: IBucket;

  /**
   * The CloudFront distribution created by this construct.
   */
  public readonly distribution: IDistribution;

  /**
   * The domain name of the CloudFront distribution.
   */
  public readonly distributionDomainName: string;

  /**
   * The custom domain name if configured.
   */
  public readonly customDomainName?: string;

  /**
   * The ACM certificate (auto-created or provided).
   */
  public readonly certificate?: ICertificate;

  /**
   * The Route53 A record if created.
   */
  public readonly dnsRecord?: ARecord;

  /**
   * The custom header name used for API Gateway access restriction.
   * Only available when api is provided.
   */
  public readonly customHeaderName?: string;

  constructor(scope: Construct, id: string, props?: FrontendConstructProps) {
    super(scope, id);

    // Validate custom domain configuration
    if (props?.domainName && !props?.certificate) {
      throw new Error(
        'certificate is required when domainName is provided. ' +
          'CloudFront requires an ACM certificate in us-east-1. ' +
          'Use ServerlessSpaSecurityConstruct.withCertificate() or withWafAndCertificate() ' +
          'to create a certificate in us-east-1, or provide an externally created certificate.'
      );
    }

    // Validate hostedZoneId and zoneName are provided together
    if ((props?.hostedZoneId && !props?.zoneName) || (!props?.hostedZoneId && props?.zoneName)) {
      throw new Error('Both hostedZoneId and zoneName must be provided together.');
    }

    // Look up hosted zone if hostedZoneId and zoneName are provided
    let hostedZone: IHostedZone | undefined;
    if (props?.hostedZoneId && props?.zoneName) {
      hostedZone = HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId: props.hostedZoneId,
        zoneName: props.zoneName,
      });
    }

    const certificate = props?.certificate;

    this.certificate = certificate;

    // Set custom header name only when api is provided
    if (props?.api) {
      this.customHeaderName = props.customHeaderName ?? 'x-origin-verify';
    }

    // Create S3 bucket with secure defaults
    const bucket = new Bucket(this, 'Bucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      publicReadAccess: false,
      ...props?.bucketProps,
    });

    this.bucket = bucket;

    // Create CloudFront Function for SPA routing
    // Rewrites paths without extensions to /index.html
    // Passes through paths with extensions (e.g., .css, .js, .png)
    const spaRoutingFunction = new CloudFrontFunction(this, 'SpaRoutingFunction', {
      code: FunctionCode.fromInline(
        `
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // Check if the URI has a file extension
  if (uri.includes('.')) {
    // Has extension, pass through (e.g., /assets/style.css, /image.png)
    return request;
  }

  // No extension, route to index.html for SPA routing
  // e.g., /about, /users/123, /
  request.uri = '/index.html';
  return request;
}
      `.trim()
      ),
    });

    // NOTE: Custom error responses are NOT used because they apply to the entire
    // CloudFront distribution (not per-behavior). This means API Gateway 403/404
    // responses would also be intercepted and replaced with index.html, hiding
    // real API errors from the client.
    //
    // SPA routing is handled by the CloudFront Function (viewer-request) which
    // rewrites extension-less paths to /index.html before reaching S3.

    // Create CloudFront distribution with S3 origin using OAC
    // Build additional behaviors for API Gateway routing if api is provided
    const additionalBehaviors: DistributionProps['additionalBehaviors'] = {};

    if (props?.api) {
      // Create RestApiOrigin for API Gateway
      // RestApiOrigin automatically handles domain extraction and stage path configuration
      const apiOrigin = new RestApiOrigin(props.api);

      // Determine whether to use Lambda@Edge
      const useEdgeFunction = !!props.edgeFunctionVersion;

      // Add /api/* behavior for API Gateway routing
      additionalBehaviors['/api/*'] = {
        origin: apiOrigin,
        allowedMethods: AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
        cachePolicy: CachePolicy.CACHING_DISABLED,
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        // Associate Lambda@Edge for origin request when edgeFunctionVersion is provided
        ...(useEdgeFunction && {
          edgeLambdas: [
            {
              functionVersion: props.edgeFunctionVersion!,
              eventType: LambdaEdgeEventType.ORIGIN_REQUEST,
            },
          ],
        }),
      };
    }

    // Build domain names array for CloudFront
    const domainNames: string[] = [];
    if (props?.domainName) {
      domainNames.push(props.domainName);
    }
    if (props?.alternativeDomainNames) {
      domainNames.push(...props.alternativeDomainNames);
    }

    const distribution = new Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(bucket),
        functionAssociations: [
          {
            function: spaRoutingFunction,
            eventType: FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      additionalBehaviors,
      defaultRootObject: 'index.html',
      priceClass: PriceClass.PRICE_CLASS_100,
      // Apply WAF WebACL if provided
      ...(props?.webAclArn && { webAclId: props.webAclArn }),
      // Apply custom domain configuration if provided
      ...(domainNames.length > 0 && { domainNames }),
      ...(certificate && { certificate }),
      ...props?.distributionProps,
    });

    this.distribution = distribution;
    this.distributionDomainName = distribution.distributionDomainName;
    this.customDomainName = props?.domainName;

    // Create Route53 A record if hostedZone and domainName are provided
    if (hostedZone && props?.domainName) {
      this.dnsRecord = new ARecord(this, 'DnsRecord', {
        zone: hostedZone,
        recordName: props.domainName,
        target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
      });

      // Create Route53 A records for alternative domain names
      if (props.alternativeDomainNames) {
        props.alternativeDomainNames.forEach((altDomain, index) => {
          new ARecord(this, `AltDnsRecord${index}`, {
            zone: hostedZone!,
            recordName: altDomain,
            target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
          });
        });
      }
    }
  }
}
