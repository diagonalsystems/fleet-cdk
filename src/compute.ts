import { Stack, Construct } from '@aws-cdk/core'

export interface FleetComputeProps {
  
}

export default function createFleetCompute (scope: Construct, props: FleetComputeProps) {
  const stack = new Stack(scope, 'FleetCompute', {})
}
