# fleet-cdk

Install Kolide Fleet in an AWS account using the CDK.

## Installation

```console
$ npm install --save fleet-cdk
```

## Usage

```js
import createFleet from 'fleet-cdk';

const app = new App();

createFleet(app, {
  env: {
    account: '123456789012',
    region: 'ca-central-1'
  }
});

```

## Dependencies

These can be either passed as a dependency or provisioned by this library.

1. ACM TLS Certificate
1. Route53 CName Record
1. JWT Secret
1. EC2 VPC Subnets
1. ECS Fargate Cluster

## Components

1. IAM Roles & Policies
1. MySQL Database
1. Network Load Balancer
1. Fleet Service
1. Redis

## Reference

- [Fleet Documentation](https://github.com/kolide/fleet/tree/master/docs)

