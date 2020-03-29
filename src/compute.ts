import { Stack, Construct } from '@aws-cdk/core';
import { Secret } from '@aws-cdk/aws-secretsmanager';
import * as ecs from '@aws-cdk/aws-ecs';
import * as rds from '@aws-cdk/aws-rds';
import * as elasticache from '@aws-cdk/aws-elasticache';
import * as ec2 from '@aws-cdk/aws-ec2';

const MYSQL_PASSWORD_SECRET_NAME = '/fleet/mysql';
const JWT_SECRET_NAME = '/fleet/jwt';
const STREAM_PREFIX = 'fleet';
const HEALTHCHECK_PORT = '3000';

interface Props {
  cluster: ecs.ICluster;
  mysql: rds.DatabaseInstance;
  mysqlSg: ec2.SecurityGroup;
  redis: elasticache.CfnCacheCluster;
  redisSg: ec2.SecurityGroup;
}

interface ResourceMap {
  service: ecs.FargateService;
}

function createFleetCompute(scope: Construct, props: Props): ResourceMap {
  const stack = new Stack(scope, 'FleetCompute', {});
  const {
    cluster, mysql, mysqlSg, redis, redisSg,
  } = props;
  const mysqlUrl = `${mysql.dbInstanceEndpointAddress}:${mysql.dbInstanceEndpointPort}`;
  const redisUrl = `${redis.attrRedisEndpointAddress}:${redis.attrRedisEndpointPort}`;

  const mysqlPassword = new Secret(stack, 'MysqlPassword', {
    secretName: MYSQL_PASSWORD_SECRET_NAME,
    generateSecretString: {
      excludePunctuation: true,
    },
  });

  const jwt = new Secret(stack, 'JwtSecret', {
    secretName: JWT_SECRET_NAME,
  });

  const taskDefinition = new ecs.TaskDefinition(stack, 'TaskDefinition', {
    compatibility: ecs.Compatibility.FARGATE,
    networkMode: ecs.NetworkMode.AWS_VPC,
    cpu: '256',
    memoryMiB: '512',
  });

  const containerDefinition = new ecs.ContainerDefinition(stack, 'ContainerDefinition', {
    taskDefinition,
    image: ecs.ContainerImage.fromRegistry('kolide/fleet'),
    logging: new ecs.AwsLogDriver({
      streamPrefix: STREAM_PREFIX,
    }),
    secrets: {
      KOLIDE_MYSQL_PASSWORD: ecs.Secret.fromSecretsManager(mysqlPassword),
      KOLIDE_AUTH_JWT_KEY: ecs.Secret.fromSecretsManager(jwt),
    },
    environment: {
      KOLIDE_MYSQL_ADDRESS: mysqlUrl,
      KOLIDE_MYSQL_DATABASE: 'fleet',
      KOLIDE_MYSQL_USERNAME: 'fleet',
      KOLIDE_SERVER_ADDRESS: '0.0.0.0:8080',
      KOLIDE_SERVER_TLS: 'false',
      KOLIDE_LOGGING_DEBUG: 'true',
      KOLIDE_REDIS_ADDRESS: redisUrl,
    },
  });

  containerDefinition.addPortMappings(...[{
    containerPort: 8080,
  }]);

  const healthCheckContainer = new ecs.ContainerDefinition(stack, 'HealthcheckContainer', {
    image: ecs.ContainerImage.fromRegistry('alpine'),
    command: ['nc', '-v', '-lk', '-p', HEALTHCHECK_PORT, '-e', 'echo', '200'],
    taskDefinition,
    logging: new ecs.AwsLogDriver({
      streamPrefix: 'fleet-healthchecks',
    }),
  });

  healthCheckContainer.addPortMappings(...[{
    containerPort: Number(HEALTHCHECK_PORT),
  }]);

  const service = new ecs.FargateService(stack, 'FargateService', {
    cluster,
    taskDefinition,
  });

  service.connections.allowFrom(
    ec2.Peer.ipv4(cluster.vpc.vpcCidrBlock),
    ec2.Port.allTcp(),
    'VPC CIDR block',
  );

  const mysqlSgRef = ec2.SecurityGroup.fromSecurityGroupId(
    stack,
    'mysqlSgRef',
    mysqlSg.securityGroupId,
  );

  const redisSgRef = ec2.SecurityGroup.fromSecurityGroupId(
    stack,
    'redisSgRef',
    redisSg.securityGroupId,
  );

  mysqlSgRef.connections.allowFrom(service.connections, new ec2.Port({
    protocol: ec2.Protocol.TCP,
    fromPort: 3306,
    toPort: 3306,
    stringRepresentation: 'Kolide Fleet ECS Service',
  }));

  redisSgRef.connections.allowFrom(service.connections, new ec2.Port({
    protocol: ec2.Protocol.TCP,
    fromPort: 6379,
    toPort: 6379,
    stringRepresentation: 'Redis',
  }));

  return {
    service,
  };
}

export default createFleetCompute;
