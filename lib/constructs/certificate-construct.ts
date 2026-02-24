import {
  Certificate,
  CertificateValidation,
  ICertificate,
} from 'aws-cdk-lib/aws-certificatemanager';
import { HostedZone, IHostedZone } from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

/**
 * Properties for CertificateConstruct.
 */
export interface CertificateConstructProps {
  /**
   * The primary domain name for the certificate.
   * @example 'www.example.com'
   */
  readonly domainName: string;

  /**
   * Route53 hosted zone ID for DNS validation.
   */
  readonly hostedZoneId: string;

  /**
   * Route53 hosted zone name for DNS validation.
   * @example 'example.com'
   */
  readonly zoneName: string;

  /**
   * Additional domain names (Subject Alternative Names) for the certificate.
   * @default - No alternative domain names
   * @example ['example.com', 'app.example.com']
   */
  readonly alternativeDomainNames?: string[];
}

/**
 * A low-level CDK construct that creates an ACM certificate with DNS validation.
 *
 * This construct must be deployed in us-east-1 region because CloudFront
 * requires ACM certificates to be in us-east-1.
 *
 * @example
 * const cert = new CertificateConstruct(this, 'Certificate', {
 *   domainName: 'www.example.com',
 *   hostedZoneId: 'Z1234567890ABC',
 *   zoneName: 'example.com',
 * });
 */
export class CertificateConstruct extends Construct {
  /**
   * The ACM certificate.
   */
  public readonly certificate: ICertificate;

  /**
   * The ACM certificate ARN.
   */
  public readonly certificateArn: string;

  constructor(scope: Construct, id: string, props: CertificateConstructProps) {
    super(scope, id);

    // Look up hosted zone for DNS validation
    const hostedZone: IHostedZone = HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.zoneName,
    });

    // Create ACM certificate with DNS validation
    const certificate = new Certificate(this, 'Certificate', {
      domainName: props.domainName,
      subjectAlternativeNames: props.alternativeDomainNames,
      validation: CertificateValidation.fromDns(hostedZone),
    });

    this.certificate = certificate;
    this.certificateArn = certificate.certificateArn;
  }
}
