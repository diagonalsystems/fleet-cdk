import { Construct } from '@aws-cdk/core';
import { IVpc } from '@aws-cdk/aws-ec2';
import { ICluster } from '@aws-cdk/aws-ecs';
import { IHostedZone } from '@aws-cdk/aws-route53';

import createFleetNetwork from './network';
import createFleetStorage from './storage';
import createFleetCompute from './compute';

interface Props {
  subdomain?: string;
  dependencies: {
    vpc: IVpc;
    cluster: ICluster;
    zone: IHostedZone;
  };
}

export default function createFleet(scope: Construct, props: Props): void {
  const storage = createFleetStorage(scope, {
    ...props.dependencies,
  });

  const compute = createFleetCompute(scope, {
    cluster: props.dependencies.cluster,
    ...storage,
  });

  createFleetNetwork(scope, {
    subdomain: props.subdomain,
    vpc: props.dependencies.vpc,
    zone: props.dependencies.zone,
    ...compute,
  });
}
