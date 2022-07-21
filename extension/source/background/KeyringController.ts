import { BlsWalletWrapper } from 'bls-wallet-clients';
import { ethers } from 'ethers';
import encryptor from 'browser-passworder';

import generateRandomHex from '../helpers/generateRandomHex';
import { NETWORK_CONFIG } from '../env';
import QuillStorageCells from '../QuillStorageCells';
import assert from '../helpers/assert';
import { PartialRpcImpl, RpcClient } from '../types/Rpc';
import ensureType from '../helpers/ensureType';

export default class KeyringController {
  constructor(
    public InternalRpc: () => RpcClient,
    public keyring: QuillStorageCells['keyring'],
    public selectedAddress: QuillStorageCells['selectedAddress'],
    public ethersProvider: ethers.providers.Provider,
  ) {}

  rpc = ensureType<PartialRpcImpl>()({
    eth_accounts: async ({ origin }) => {
      if (origin === window.location.origin) {
        return (await this.keyring.read()).wallets.map(
          ({ address }) => address,
        );
      }

      const selectedAddress = await this.selectedAddress.read();

      // TODO (merge-ok) Expose no accounts if this origin has not been
      // approved, preventing account-requiring RPC methods from completing
      // successfully only show address if account is unlocked
      // https://github.com/web3well/bls-wallet/issues/224
      return selectedAddress ? [selectedAddress] : [];
    },

    eth_requestAccounts: async (_request) => {
      const selectedAddress = await this.selectedAddress.read();
      const accounts = selectedAddress ? [selectedAddress] : [];
      return accounts;
    },

    eth_coinbase: async (_request) =>
      (await this.selectedAddress.read()) ?? null,

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

      const keyPair = (await this.keyring.read()).wallets.find(
        (x) => x.address === address,
      );

      assert(keyPair !== undefined, () => new Error('key does not exist'));

      return keyPair.privateKey;
    },

    addAccount: async ({ params: [privateKey = generateRandomHex(256)] }) => {
      const { wallets } = await this.keyring.read();

      assert(
        wallets.every((w) => w.privateKey !== privateKey),
        () => new Error('Wallet already exists'),
      );

      const address = await this.BlsWalletAddress(privateKey);

      wallets.push({ privateKey, address });
      await this.keyring.update({ wallets });

      return address;
    },

    removeAccount: async ({ params: [address] }) => {
      const { wallets } = await this.keyring.read();
      const newWallets = wallets.filter((w) => w.address !== address);

      assert(
        newWallets.length < wallets.length,
        () => new Error('Account did not exist'),
      );

      await this.keyring.update({ wallets: newWallets });
    },

    createNewVault: async ({ params: [password] }) => {
      const { HDPhrase, nextHDIndex } = await this.keyring.read();
      const HDPath = "m/44'/60'/0'/0";

      const vaultData = {
        HDPhrase,
        HDPath,
        numberOfAccounts: nextHDIndex,
      };

      const encryptedString = await encryptor.encrypt(password, vaultData);

      await this.keyring.update({ vault: encryptedString });
    },
  });

  async BlsWalletAddress(privateKey: string): Promise<string> {
    return BlsWalletWrapper.Address(
      privateKey,
      NETWORK_CONFIG.addresses.verificationGateway,
      this.ethersProvider,
    );
  }
}
