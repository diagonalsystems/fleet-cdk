import { Stack, Construct } from '@aws-cdk/core';
import { Secret } from '@aws-cdk/aws-secretsmanager';
import {
  TaskDefinition, Compatibility, NetworkMode, ContainerDefinition, ContainerImage, AwsLogDriver,
} from '@aws-cdk/aws-ecs';
import * as ecs from '@aws-cdk/aws-ecs';
import * as rds from '@aws-cdk/aws-rds';
import * as elasticache from '@aws-cdk/aws-elasticache';
import {
  Peer, Port, SecurityGroup, Protocol,
} from '@aws-cdk/aws-ec2';

export interface FleetComputeProps {
  cluster: ecs.ICluster,
  mysql: rds.DatabaseInstance,
  mysqlSg: SecurityGroup,
  redis: elasticache.CfnCacheCluster,
  redisSg: SecurityGroup
}

export default function createFleetCompute(scope: Construct, props: FleetComputeProps) {
  const stack = new Stack(scope, 'FleetCompute', {});
  const {
    cluster, mysql, mysqlSg, redis, redisSg,
  } = props;

  const mysqlPassword = new Secret(stack, 'MysqlPassword', {
    secretName: '/fleet/mysql',
    generateSecretString: {
      excludePunctuation: true,
    },
  });

  const jwt = new Secret(stack, 'jwt', {
    secretName: '/fleet/jwt',
  });

  const taskDefinition = new TaskDefinition(stack, 'task-definition', {
    compatibility: Compatibility.FARGATE,
    networkMode: NetworkMode.AWS_VPC,
    cpu: '512',
    memoryMiB: '1024',
  });

  const containerDefinition = new ContainerDefinition(stack, 'container-definition', {
    image: ContainerImage.fromRegistry('kolide/fleet'),
    taskDefinition,
    logging: new AwsLogDriver({
      streamPrefix: 'fleet',
    }),
    secrets: {
      KOLIDE_MYSQL_PASSWORD: ecs.Secret.fromSecretsManager(mysqlPassword),
      KOLIDE_AUTH_JWT_KEY: ecs.Secret.fromSecretsManager(jwt),
    },
    environment: {
      KOLIDE_MYSQL_ADDRESS: `${mysql.dbInstanceEndpointAddress}:${mysql.dbInstanceEndpointPort}`,
      KOLIDE_MYSQL_DATABASE: 'fleet',
      KOLIDE_MYSQL_USERNAME: 'fleet',
      KOLIDE_SERVER_ADDRESS: '0.0.0.0:8080',
      KOLIDE_SERVER_TLS: 'false',
      KOLIDE_LOGGING_DEBUG: 'true',
      KOLIDE_REDIS_ADDRESS: `${redis.attrRedisEndpointAddress}:${redis.attrRedisEndpointPort}`,
    },
  });

  containerDefinition.addPortMappings(...[{
    containerPort: 8080,
  }]);

  const healthCheckPort = '3000';

  const healthCheckContainer = new ecs.ContainerDefinition(stack, 'healthcheck-container', {
    image: ecs.ContainerImage.fromRegistry('alpine'),
    command: ['nc', '-v', '-lk', '-p', healthCheckPort, '-e', 'echo', '200'],
    taskDefinition,
    logging: new ecs.AwsLogDriver({
      streamPrefix: 'fleet-healthchecks',
    }),
  });

  healthCheckContainer.addPortMappings(...[{
    containerPort: Number(healthCheckPort),
  }]);

  const service = new ecs.FargateService(stack, 'fargate-service', {
    cluster,
    taskDefinition,
  });

  service.connections.allowFrom(
    Peer.ipv4(cluster.vpc.vpcCidrBlock),
    Port.allTcp(),
    'VPC CIDR block',
  );

  const mysqlSgRef = SecurityGroup.fromSecurityGroupId(stack, 'mysql-sg-ref', mysqlSg.securityGroupId);
  const redisSgRef = SecurityGroup.fromSecurityGroupId(stack, 'redis-sg-ref', redisSg.securityGroupId);

  mysqlSgRef.connections.allowFrom(service.connections, new Port({
    protocol: Protocol.TCP,
    fromPort: 3306,
    toPort: 3306,
    stringRepresentation: 'Kolide Fleet ECS Service',
  }));

  redisSgRef.connections.allowFrom(service.connections, new Port({
    protocol: Protocol.TCP,
    fromPort: 6379,
    toPort: 6379,
    stringRepresentation: 'Redis',
  }));

  return {
    service,
  };
}
