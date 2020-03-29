import { Stack, Construct } from '@aws-cdk/core';
import { IVpc } from '@aws-cdk/aws-ec2';
import { ICluster } from '@aws-cdk/aws-ecs';
import { IHostedZone } from '@aws-cdk/aws-route53';

import createFleetNetwork from './network';
import createFleetStorage from './storage';
import createFleetCompute from './compute';

const DEFAULT_SUBDOMAIN = 'fleet';

export interface FleetProps {
  subdomain: string,
  dependencies: {
    vpc: IVpc,
    cluster: ICluster,
    zone: IHostedZone
  }
}

export default function fleet(scope: Construct, props: FleetProps) {
  const storage = createFleetStorage(scope, {
    ...props.dependencies,
  });

  const compute = createFleetCompute(scope, {
    cluster: props.dependencies.cluster,
    ...storage,
  });

  createFleetNetwork(scope, {
    vpc: props.dependencies.vpc,
    zone: props.dependencies.zone,
    ...compute,
    subdomain: props.subdomain || DEFAULT_SUBDOMAIN,
  });
}
