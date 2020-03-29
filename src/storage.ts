import { Stack, Construct } from '@aws-cdk/core'

export interface FleetStorageProps {
  
}

export default function createFleetStorage (scope: Construct, props: FleetStorageProps) {
  const stack = new Stack(scope, 'FleetStorage', {})
}
