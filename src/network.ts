import { Stack, Construct } from '@aws-cdk/core'

export interface FleetNetworkProps {

}

export function createFleetNetwork (scope: Construct, props: FleetNetworkProps) {
  const stack = new Stack(scope, 'FleetNetwork', {})
}
