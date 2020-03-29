import { Stack, Construct, Duration } from '@aws-cdk/core';
import {
  NetworkTargetGroup, TargetType, Protocol, NetworkLoadBalancer, NetworkListener, SslPolicy, ListenerCertificate,
} from '@aws-cdk/aws-elasticloadbalancingv2';
import {
  CnameRecord, HostedZone, RecordSet, RecordType, RecordTarget, IHostedZone,
} from '@aws-cdk/aws-route53';
import { LoadBalancerTarget } from '@aws-cdk/aws-route53-targets';
import { DnsValidatedCertificate } from '@aws-cdk/aws-certificatemanager';
import { IVpc } from '@aws-cdk/aws-ec2';
import { FargateService } from '@aws-cdk/aws-ecs';

export interface FleetNetworkProps {
  vpc: IVpc,
  service: FargateService,
  zone: IHostedZone,
  subdomain: string
}

export default function createFleetNetwork(scope: Construct, props: FleetNetworkProps) {
  const stack = new Stack(scope, 'FleetNetwork', {});
  const {
    vpc, service, zone, subdomain,
  } = props;

  const cert = new DnsValidatedCertificate(stack, 'Cert', {
    hostedZone: zone,
    domainName: `${subdomain}.${zone.zoneName}`,
  });

  const loadBalancer = new NetworkLoadBalancer(stack, 'Nlb', {
    vpc,
    internetFacing: true,
  });

  const targetGroup = new NetworkTargetGroup(stack, 'TargetGroup', {
    vpc,
    port: 8080,
    targetType: TargetType.IP,
    targets: [service],
    deregistrationDelay: Duration.seconds(0),
    healthCheck: {
      port: '3000',
      protocol: Protocol.TCP,
    },
  });

  const listenerCert = ListenerCertificate.fromCertificateManager(cert);

  const listener = new NetworkListener(stack, 'Listener', {
    loadBalancer,
    port: 443,
    defaultTargetGroups: [targetGroup],
    protocol: Protocol.TLS,
    sslPolicy: SslPolicy.RECOMMENDED,
    certificates: [listenerCert],
  });

  const cname = new RecordSet(stack, 'FleetCname', {
    zone,
    recordName: subdomain,
    recordType: RecordType.CNAME,
    target: RecordTarget.fromAlias(new LoadBalancerTarget(loadBalancer)),
  });

  return {
    cert,
    loadBalancer,
    targetGroup,
    listener,
    cname,
  };
}
