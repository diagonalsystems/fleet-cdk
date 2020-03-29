import {
  Stack, Construct, Duration,
} from '@aws-cdk/core';
import * as elb from '@aws-cdk/aws-elasticloadbalancingv2';
import * as route53 from '@aws-cdk/aws-route53';
import { LoadBalancerTarget } from '@aws-cdk/aws-route53-targets';
import { DnsValidatedCertificate } from '@aws-cdk/aws-certificatemanager';
import { IVpc } from '@aws-cdk/aws-ec2';
import { FargateService } from '@aws-cdk/aws-ecs';

const DEFAULT_SUBDOMAIN = 'fleet';

interface Props {
  vpc: IVpc;
  service: FargateService;
  zone: route53.IHostedZone;
  subdomain?: string;
}

interface ResourceMap {
  cert: DnsValidatedCertificate;
  loadBalancer: elb.NetworkLoadBalancer;
  listener: elb.NetworkListener;
  cname: route53.RecordSet;
}

function createFleetNetwork(scope: Construct, props: Props): ResourceMap {
  const stack = new Stack(scope, 'FleetNetwork');
  const { vpc, service, zone } = props;

  const subdomain = props.subdomain || DEFAULT_SUBDOMAIN;

  const cert = new DnsValidatedCertificate(stack, 'Cert', {
    hostedZone: zone,
    domainName: `${subdomain}.${zone.zoneName}`,
  });

  const loadBalancer = new elb.NetworkLoadBalancer(stack, 'Nlb', {
    vpc,
    internetFacing: true,
  });

  const targetGroup = new elb.NetworkTargetGroup(stack, 'TargetGroup', {
    vpc,
    port: 8080,
    targetType: elb.TargetType.IP,
    targets: [service],
    deregistrationDelay: Duration.seconds(0),
    healthCheck: {
      port: '3000',
      protocol: elb.Protocol.TCP,
    },
  });

  const listenerCert = elb.ListenerCertificate.fromCertificateManager(cert);

  const listener = new elb.NetworkListener(stack, 'Listener', {
    loadBalancer,
    port: 443,
    defaultTargetGroups: [targetGroup],
    protocol: elb.Protocol.TLS,
    sslPolicy: elb.SslPolicy.RECOMMENDED,
    certificates: [listenerCert],
  });

  const cname = new route53.RecordSet(stack, 'FleetCname', {
    zone,
    recordName: subdomain,
    recordType: route53.RecordType.CNAME,
    target: route53.RecordTarget.fromAlias(new LoadBalancerTarget(loadBalancer)),
  });

  return {
    cert,
    loadBalancer,
    listener,
    cname,
  };
}

export default createFleetNetwork;
