import { App, Stack } from '@aws-cdk/core';
import { Vpc } from '@aws-cdk/aws-ec2';
import { Cluster } from '@aws-cdk/aws-ecs';
import { HostedZone } from '@aws-cdk/aws-route53';
import createFleet from '../src';

const app = new App();
const stack = new Stack(app, 'FleetTestDependencies');

createFleet(app, {
  dependencies: {
    vpc: new Vpc(stack, 'Vpc'),
    cluster: new Cluster(stack, 'Fargate'),
    zone: new HostedZone(stack, 'Zone', {
      zoneName: 'fleet-cdk',
    }),
  },
});

app.synth();
