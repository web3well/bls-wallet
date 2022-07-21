import { BlsWalletWrapper } from 'bls-wallet-clients';
import { ethers } from 'ethers';
import { keccak256 } from 'ethers/lib/utils';
import generateRandomHex from '../helpers/generateRandomHex';
import QuillStorageCells from '../QuillStorageCells';
import assert from '../helpers/assert';
import { PartialRpcImpl, RpcClient } from '../types/Rpc';
import ensureType from '../helpers/ensureType';
import BlsNetworksConfig from '../BlsNetworksConfig';
import { IReadableCell } from '../cells/ICell';
import mixtureCopy from '../cells/mixtureCopy';
import getBlsNetworkConfig from './getBlsNetworkConfig';

export default class KeyringController {
  constructor(
    public blsNetworksConfig: BlsNetworksConfig,
    public InternalRpc: () => RpcClient,
    public keyring: QuillStorageCells['keyring'],
    public selectedPublicKeyHash: QuillStorageCells['selectedPublicKeyHash'],
    public network: QuillStorageCells['network'],
    public ethersProvider: IReadableCell<ethers.providers.Provider>,
  ) {}

  rpc = ensureType<PartialRpcImpl>()({
    eth_accounts: async ({ origin }) => {
      if (origin === window.location.origin) {
        const walletsNetworkData = await this.getWalletsNetworkData();
        const keyring = await this.keyring.read();

        return keyring.wallets.map((w) => {
          const address = walletsNetworkData[w.publicKeyHash]?.address;

          assert(
            address !== undefined,
            () => new Error('Unexpected missing network data'),
          );

          return address;
        });
      }

      const selectedPublicKeyHash = await this.selectedPublicKeyHash.read();

      // TODO (merge-ok) Expose no accounts if this origin has not been
      // approved, preventing account-requiring RPC methods from completing
      // successfully only show address if account is unlocked
      // https://github.com/web3well/bls-wallet/issues/224
      return selectedPublicKeyHash
        ? [await this.InternalRpc().pkHashToAddress(selectedPublicKeyHash)]
        : [];
    },

    eth_requestAccounts: async (_request) => {
      const selectedAddress = await this.selectedPublicKeyHash.read();
      const accounts = selectedAddress ? [selectedAddress] : [];
      return accounts;
    },

    eth_coinbase: async (_request) => {
      const selectedPublicKeyHash = await this.selectedPublicKeyHash.read();

      if (selectedPublicKeyHash === undefined) {
        return null;
      }

      return await this.InternalRpc().pkHashToAddress(selectedPublicKeyHash);
    },

    /**
     * Creates a Deterministic Account based on seed phrase
     */
    addHDAccount: async (_request) => {
      const { HDPhrase, nextHDIndex } = await this.keyring.read();
      const node = ethers.utils.HDNode.fromMnemonic(HDPhrase);

      const { privateKey } = node.derivePath(`m/44'/60'/0'/0/${nextHDIndex}`);

      const address: string = await this.InternalRpc().addAccount(privateKey);
      await this.keyring.update({ nextHDIndex: nextHDIndex + 1 });

      return address;
    },

    setHDPhrase: async ({ params: [HDPhrase] }) => {
      await this.keyring.update({ HDPhrase });
    },

    lookupPrivateKey: async ({ params: [rawAddress] }) => {
      const address = ethers.utils.getAddress(rawAddress);
      const network = await this.network.read();

      const keyPair = (await this.keyring.read()).wallets.find(
        (x) => x.networks[network.networkKey]?.address === address,
      );

      assert(keyPair !== undefined, () => new Error('key does not exist'));

      return keyPair.privateKey;
    },

    pkHashToAddress: async ({ params: [publicKeyHash] }) => {
      const walletsNetworkData = await this.getWalletsNetworkData();
      const networkData = walletsNetworkData[publicKeyHash];

      assert(
        networkData !== undefined,
        () => new Error('Unexpected missing network data'),
      );

      return networkData.address;
    },

    addAccount: async ({ params: [privateKey = generateRandomHex(256)] }) => {
      const { wallets } = await this.keyring.read();

      assert(
        wallets.every((w) => w.privateKey !== privateKey),
        () => new Error('Wallet already exists'),
      );

      const blsWalletWrapper = await this.BlsWalletWrapper(privateKey);
      const network = await this.network.read();

      const blsNetworkConfig = getBlsNetworkConfig(
        network,
        this.blsNetworksConfig,
      );

      wallets.push({
        privateKey,
        publicKeyHash: keccak256(blsWalletWrapper.PublicKeyStr()),
        networks: {
          [network.networkKey]: {
            address: blsWalletWrapper.address,
            originalGateway: blsNetworkConfig.addresses.verificationGateway,
          },
        },
      });

      await this.keyring.update({ wallets });

      return blsWalletWrapper.address;
    },

    removeAccount: async ({ params: [address] }) => {
      const { wallets } = await this.keyring.read();
      const network = await this.network.read();

      const newWallets = wallets.filter(
        (w) => w.networks[network.networkKey]?.address !== address,
      );

      assert(
        newWallets.length < wallets.length,
        () => new Error('Account did not exist'),
      );

      await this.keyring.update({ wallets: newWallets });
    },
  });

  async BlsWalletWrapper(privateKey: string): Promise<BlsWalletWrapper> {
    const blsNetworkConfig = getBlsNetworkConfig(
      await this.network.read(),
      this.blsNetworksConfig,
    );

    return BlsWalletWrapper.connect(
      privateKey,
      blsNetworkConfig.addresses.verificationGateway,
      await this.ethersProvider.read(),
    );
  }

  async getWalletsNetworkData(): Promise<
    Record<string, { originalGateway: string; address: string } | undefined>
  > {
    const walletsNetworkData: Record<
      string,
      { originalGateway: string; address: string }
    > = {};

    const network = await this.network.read();

    const blsNetworkConfig = getBlsNetworkConfig(
      network,
      this.blsNetworksConfig,
    );

    const keyring = mixtureCopy(await this.keyring.read());
    let keyringUpdated = false;

    await Promise.all(
      keyring.wallets.map(async (wallet) => {
        let networkDataForWallet = wallet.networks[network.networkKey];

        if (networkDataForWallet === undefined) {
          networkDataForWallet = {
            originalGateway: blsNetworkConfig.addresses.verificationGateway,
            address: await (
              await this.BlsWalletWrapper(wallet.privateKey)
            ).address,
          };

          // eslint-disable-next-line no-param-reassign
          wallet.networks[network.networkKey] = networkDataForWallet;
          keyringUpdated = true;
        }

        walletsNetworkData[wallet.publicKeyHash] = networkDataForWallet;
      }),
    );

    if (keyringUpdated) {
      await this.keyring.write(keyring);
    }

    return walletsNetworkData;
  }
}
