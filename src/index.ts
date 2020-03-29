import { Stack, Construct } from '@aws-cdk/core'

export interface FleetProps {
  
}

export default function createFleet (scope: Construct, props: FleetProps) {
  const stack = new Stack(scope, 'Fleet', {})
}
