import { Stack, Construct } from '@aws-cdk/core';
import { Secret } from '@aws-cdk/aws-secretsmanager';
import * as rds from '@aws-cdk/aws-rds';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as elasticache from '@aws-cdk/aws-elasticache';

const MYSQL_PASSWORD_SECRET_NAME = '/fleet/MysqlMaster';
const MYSQL_MASTER_USERNAME = 'mysql_admin';
const MYSQL_STORAGE_GB = 30;
const REDIS_NODE_TYPE = 'cache.t2.micro';

interface Props {
  vpc: ec2.IVpc;
}

interface ResourceMap {
  mysql: rds.DatabaseInstance;
  mysqlSg: ec2.SecurityGroup;
  redis: elasticache.CfnCacheCluster;
  redisSg: ec2.SecurityGroup;
}

function createFleetStorage(scope: Construct, props: Props): ResourceMap {
  const stack = new Stack(scope, 'FleetStorage', {});
  const { vpc } = props;

  const mysqlMasterPassword = new Secret(stack, 'MysqlMasterPassword', {
    secretName: MYSQL_PASSWORD_SECRET_NAME,
    generateSecretString: {
      excludePunctuation: true,
    },
  });

  const mysqlSg = new ec2.SecurityGroup(stack, 'MysqlSg', { vpc, allowAllOutbound: false });

  const instanceClass = ec2.InstanceType.of(
    ec2.InstanceClass.T3,
    ec2.InstanceSize.SMALL,
  );

  const mysql = new rds.DatabaseInstance(stack, 'Mysql', {
    instanceClass,
    vpc,
    engine: rds.DatabaseInstanceEngine.MYSQL,
    masterUsername: MYSQL_MASTER_USERNAME,
    masterUserPassword: mysqlMasterPassword.secretValue,
    allocatedStorage: MYSQL_STORAGE_GB,
    multiAz: false,
    securityGroups: [mysqlSg],
  });

  const subnetGroup = new elasticache.CfnSubnetGroup(stack, 'SubnetGroup', {
    cacheSubnetGroupName: 'FleetRedisSubnetGroup',
    description: 'Subnet group for the Fleet Redis cluster',
    subnetIds: vpc.privateSubnets.map((subnet) => subnet.subnetId),
  });

  const redisSg = new ec2.SecurityGroup(stack, 'RedisSg', {
    vpc,
    allowAllOutbound: false,
  });

  const redis = new elasticache.CfnCacheCluster(stack, 'Redis', {
    engine: 'redis',
    cacheNodeType: REDIS_NODE_TYPE,
    numCacheNodes: 1,
    vpcSecurityGroupIds: [redisSg.securityGroupId],
    cacheSubnetGroupName: subnetGroup.cacheSubnetGroupName,
  });

  redis.addDependsOn(subnetGroup);

  return {
    mysql,
    mysqlSg,
    redis,
    redisSg,
  };
}

export default createFleetStorage;
