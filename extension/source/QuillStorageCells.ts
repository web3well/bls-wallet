import { ethers } from 'ethers';
import * as io from 'io-ts';

import CellCollection from './cells/CellCollection';
import TransformCell from './cells/TransformCell';
import {
  builtinChainIdToName,
  builtinProviderConfigs,
  ProviderConfig,
} from './background/networks';
import { Preferences, Theme } from './background/Preferences';
import AsyncReturnType from './types/AsyncReturnType';
import { DEFAULT_CHAIN_ID_HEX } from './env';
import { FormulaCell } from './cells/FormulaCell';
import assert from './helpers/assert';
import { QuillTransaction } from './types/Rpc';

// FIXME: If defaults were built into our io types, we could easily add new
// fields that always have concrete values incrementally without breaking
// existing clients.

function QuillStorageCells(storage: CellCollection) {
  const rootCells = {
    onboarding: storage.Cell(
      'onboarding',
      io.type({
        autoOpened: io.boolean,
        completed: io.boolean,
        tempPassword: io.string,
      }),
      () => ({
        autoOpened: false,
        completed: false,
        tempPassword: '',
      }),
    ),
    keyring: storage.Cell(
      'keyring',
      io.type({
        HDPhrase: io.string,
        nextHDIndex: io.number,
        wallets: io.array(
          io.type({
            privateKey: io.string,
            address: io.string,
          }),
        ),
        vault: io.string,
      }),
      () => ({
        HDPhrase: ethers.Wallet.createRandom().mnemonic.phrase,
        nextHDIndex: 0,
        wallets: [],
        vault: '',
      }),
    ),
    transactions: storage.Cell(
      'transactions',
      io.type({
        outgoing: io.array(QuillTransaction),
      }),
      () => ({ outgoing: [] }),
    ),
    network: storage.Cell('network', ProviderConfig, () => {
      const networkName = builtinChainIdToName(DEFAULT_CHAIN_ID_HEX);
      const config = builtinProviderConfigs[networkName];

      return config;
    }),
    preferences: storage.Cell('preferences', Preferences, () => ({
      identities: {},
      selectedAddress: undefined,
      developerSettings: {
        // For now, default to dev settings that are appropriate for the bls
        // wallet team. FIXME: The defaults that get bundled into the extension
        // should probably be configurable.
        breakOnAssertionFailures: true,
        exposeEthereumRpc: false,
        rpcLogging: {
          background: true,
          inPage: true,
        },
      },
    })),
  };

  const providerStateCells = {
    chainId: FormulaCell.Sub(rootCells.network, 'chainId'),
    selectedAddress: TransformCell.Sub(
      rootCells.preferences,
      'selectedAddress',
    ),
    developerSettings: TransformCell.Sub(
      rootCells.preferences,
      'developerSettings',
    ),
  };

  return {
    ...rootCells,
    providerState: new FormulaCell(
      providerStateCells,
      ({ $chainId, $developerSettings, $selectedAddress }) => ({
        chainId: $chainId,
        developerSettings: $developerSettings,
        selectedAddress: $selectedAddress,
      }),
    ),
    ...providerStateCells,

    theme: new FormulaCell(
      { preferences: rootCells.preferences },
      ({ $preferences: { selectedAddress, identities } }): Theme => {
        if (selectedAddress === undefined) {
          return 'light';
        }

        const identity = identities[selectedAddress];
        assert(identity !== undefined);

        return identity.theme;
      },
    ),

    breakOnAssertionFailures: TransformCell.Sub(
      providerStateCells.developerSettings,
      'breakOnAssertionFailures',
    ),

    exposeEthereumRpc: TransformCell.Sub(
      providerStateCells.developerSettings,
      'exposeEthereumRpc',
    ),
  };
}

type QuillStorageCells = ReturnType<typeof QuillStorageCells>;

export default QuillStorageCells;

export type QuillState<K extends keyof QuillStorageCells> = AsyncReturnType<
  QuillStorageCells[K]['read']
>;
