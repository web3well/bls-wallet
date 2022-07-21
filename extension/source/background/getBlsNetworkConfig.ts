import { NetworkConfig } from 'bls-wallet-clients';
import assert from '../helpers/assert';
import { QuillState } from '../QuillStorageCells';

export default function getBlsNetworkConfig(
  network: QuillState<'network'>,
  blsNetworksConfig: Record<string, NetworkConfig | undefined>,
) {
  const blsNetworkConfig = blsNetworksConfig[network.networkKey];

  assert(
    blsNetworkConfig !== undefined,
    () => new Error(`bls network config not found for ${network.displayName}`),
  );

  return blsNetworkConfig;
}
