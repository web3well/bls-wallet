import React, { useMemo } from 'react';

import {
  AggregatorUtilities__factory, // eslint-disable-line
  BlsWalletWrapper,
  // eslint-disable-next-line camelcase
  MockERC20__factory,
  // eslint-disable-next-line camelcase
  VerificationGateway__factory,
} from 'bls-wallet-clients';
import elcc from './cells/extensionLocalCellCollection';
import assert from './helpers/assert';
import QuillStorageCells from './QuillStorageCells';
import QuillEthereumProvider from './QuillEthereumProvider';
import EthersProvider from './EthersProvider';
import CellCollection from './cells/CellCollection';
import { FormulaCell } from './cells/FormulaCell';
import QuillLongPollingCell from './QuillLongPollingCell';
import TransformCell from './cells/TransformCell';
import forEach from './cells/forEach';
import { loadBlsNetworksConfig } from './BlsNetworksConfig';
import { RpcClient } from './types/Rpc';
import Config, { loadConfig } from './Config';

export type QuillContextValue = ReturnType<typeof getQuillContextValue>;

function getQuillContextValue() {
  const ethereum = window.ethereum as QuillEthereumProvider;
  assert(ethereum?.isQuill);
  assert(ethereum.rpc !== undefined);

  const config = loadConfig();
  const blsNetworksConfig = loadBlsNetworksConfig();

  const cells = QuillContextCells(config, elcc, ethereum, ethereum.rpc);

  forEach(cells.onboarding, (onboarding) => {
    if (!onboarding.autoOpened) {
      // Auto-opening is the very first thing that happens, so if it hasn't
      // happened, we should not be open.
      // This is used to make debug.reset() mimic a complete uninstall and
      // reinstall of the extension - all extension pages should close on
      // uninstall.
      window.close();
    }
  });

  const networkAndEthersProvider = new FormulaCell(
    { network: cells.network },
    ({ $network }) => ({
      network: $network,
      ethersProvider: EthersProvider(ethereum),
    }),
  );

  const debugUtils = new FormulaCell(
    { networkAndEthersProvider, keyring: cells.keyring },
    ({ $networkAndEthersProvider, $keyring }) => ({
      ...$networkAndEthersProvider,
      keyring: $keyring,
    }),
  );

  forEach(debugUtils, async ({ network, ethersProvider, keyring }) => {
    window.debug ??= {};

    const blsNetworkConfig = blsNetworksConfig[network.networkKey];

    if (blsNetworkConfig === undefined) {
      window.debug.contracts = undefined;
      return;
    }

    window.debug.contracts = {
      // eslint-disable-next-line camelcase
      verificationGateway: VerificationGateway__factory.connect(
        blsNetworkConfig.addresses.verificationGateway,
        ethersProvider,
      ),
      // eslint-disable-next-line camelcase
      testToken: MockERC20__factory.connect(
        blsNetworkConfig.addresses.testToken,
        ethersProvider,
      ),
      // eslint-disable-next-line camelcase
      aggregatorUtilities: AggregatorUtilities__factory.connect(
        blsNetworkConfig.addresses.utilities,
        ethersProvider,
      ),
    };

    window.debug.wallets = await Promise.all(
      keyring.wallets.map((w) =>
        BlsWalletWrapper.connect(
          w.privateKey,
          blsNetworkConfig.addresses.verificationGateway,
          ethersProvider,
        ),
      ),
    );
  });

  return {
    ethereum,
    ethersProvider: FormulaCell.Sub(networkAndEthersProvider, 'ethersProvider'),
    rpc: ethereum.rpc,
    cells,
    config,
    blsNetworksConfig,
  };
}

const QuillContext = React.createContext<QuillContextValue>(
  // QuillEthereumProvider render will ensure this is set properly
  // before other components load.
  {} as QuillContextValue,
);

export function useQuill() {
  return React.useContext(QuillContext);
}

type Props = {
  children: React.ReactNode;
};

export function QuillContextProvider({ children }: Props) {
  const quill = useMemo(() => getQuillContextValue(), []);

  window.debug ??= {};
  window.debug.quill = quill;

  return (
    <QuillContext.Provider value={quill}>{children}</QuillContext.Provider>
  );
}

function QuillContextCells(
  config: Config,
  storage: CellCollection,
  ethereum: QuillEthereumProvider,
  rpc: RpcClient,
) {
  const storageCells = QuillStorageCells(config, storage);

  const rpcLogging = TransformCell.Sub(
    storageCells.developerSettings,
    'rpcLogging',
  );

  return {
    ...storageCells,
    networkJson: new FormulaCell(
      { network: storageCells.network },
      ({ $network }) => JSON.stringify($network, null, 2),
    ),
    blockNumber: QuillLongPollingCell(ethereum, 'blockNumber'),
    rpcBackgroundLogging: TransformCell.Sub(rpcLogging, 'background'),
    rpcInPageLogging: TransformCell.Sub(rpcLogging, 'inPage'),
    currencyConversion: QuillLongPollingCell(ethereum, 'currencyConversion'),
    networkDisplayName: new TransformCell(
      storageCells.network,
      ($network) => $network.displayName,
      ($network, newDisplayName) => {
        for (const builtinNetwork of Object.values(config.builtinNetworks)) {
          if (builtinNetwork?.displayName === newDisplayName) {
            return builtinNetwork;
          }
        }

        console.error(`Network not found: ${newDisplayName}`);
        return $network;
      },
    ),
    ethAccounts: new FormulaCell(
      { network: storageCells.network, keyring: storageCells.keyring },
      () => rpc.eth_accounts(),
    ),
    selectedAddress: new FormulaCell(
      {
        selectedPublicKeyHash: storageCells.selectedPublicKeyHash,
        network: storageCells.network,
      },
      ({ $selectedPublicKeyHash }) =>
        $selectedPublicKeyHash && rpc.pkHashToAddress($selectedPublicKeyHash),
    ),
  };
}
