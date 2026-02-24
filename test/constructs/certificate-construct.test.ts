import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { CertificateConstruct } from '../../lib/constructs/certificate-construct';

describe('CertificateConstruct', () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack', {
      env: { region: 'us-east-1', account: '123456789012' },
    });
  });

  describe('ACM Certificate Creation', () => {
    test('creates ACM certificate with DNS validation', () => {
      new CertificateConstruct(stack, 'Cert', {
        domainName: 'www.example.com',
        hostedZoneId: 'Z1234567890ABC',
        zoneName: 'example.com',
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::CertificateManager::Certificate', 1);
      template.hasResourceProperties('AWS::CertificateManager::Certificate', {
        DomainName: 'www.example.com',
        ValidationMethod: 'DNS',
      });
    });

    test('sets domainName correctly', () => {
      new CertificateConstruct(stack, 'Cert', {
        domainName: 'app.example.com',
        hostedZoneId: 'Z1234567890ABC',
        zoneName: 'example.com',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::CertificateManager::Certificate', {
        DomainName: 'app.example.com',
      });
    });

    test('sets alternativeDomainNames as SubjectAlternativeNames', () => {
      new CertificateConstruct(stack, 'Cert', {
        domainName: 'www.example.com',
        hostedZoneId: 'Z1234567890ABC',
        zoneName: 'example.com',
        alternativeDomainNames: ['example.com', 'api.example.com'],
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::CertificateManager::Certificate', {
        DomainName: 'www.example.com',
        SubjectAlternativeNames: ['example.com', 'api.example.com'],
      });
    });

    test('does not set SubjectAlternativeNames when alternativeDomainNames is not provided', () => {
      new CertificateConstruct(stack, 'Cert', {
        domainName: 'www.example.com',
        hostedZoneId: 'Z1234567890ABC',
        zoneName: 'example.com',
      });

      const template = Template.fromStack(stack);
      // Certificate should not have SubjectAlternativeNames
      const certs = template.findResources('AWS::CertificateManager::Certificate');
      const certProps = Object.values(certs)[0].Properties;
      expect(certProps.SubjectAlternativeNames).toBeUndefined();
    });
  });

  describe('Output Properties', () => {
    test('exposes certificate property', () => {
      const cert = new CertificateConstruct(stack, 'Cert', {
        domainName: 'www.example.com',
        hostedZoneId: 'Z1234567890ABC',
        zoneName: 'example.com',
      });

      expect(cert.certificate).toBeDefined();
    });

    test('exposes certificateArn property', () => {
      const cert = new CertificateConstruct(stack, 'Cert', {
        domainName: 'www.example.com',
        hostedZoneId: 'Z1234567890ABC',
        zoneName: 'example.com',
      });

      expect(cert.certificateArn).toBeDefined();
      expect(typeof cert.certificateArn).toBe('string');
    });
  });
});
