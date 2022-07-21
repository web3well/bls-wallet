import * as io from 'io-ts';
import { Aggregator, BlsWalletWrapper } from 'bls-wallet-clients';
import { ethers } from 'ethers';
import assertType from '../cells/assertType';

import assert from '../helpers/assert';
import ensureType from '../helpers/ensureType';
import { PartialRpcImpl, RpcClient, SendTransactionParams } from '../types/Rpc';
import KeyringController from './KeyringController';
import NetworkController from './NetworkController';
import optional from '../types/optional';
import TransactionsController from './TransactionsController';
import { IReadableCell } from '../cells/ICell';
import getBlsNetworkConfig from './getBlsNetworkConfig';
import BlsNetworksConfig from '../BlsNetworksConfig';

export default class AggregatorController {
  // This is just kept in memory because it supports setting the preferred
  // aggregator for the particular provider only.
  preferredAggregators: Record<string, string | undefined> = {};

  knownTransactions: Record<
    string,
    | (SendTransactionParams & {
        nonce: string;
        value: string;
        aggregatorUrl: string;
      })
    | undefined
  > = {};

  constructor(
    public blsNetworksConfig: BlsNetworksConfig,
    public InternalRpc: () => RpcClient,
    public networkController: NetworkController,
    public keyringController: KeyringController,
    public transactionsController: TransactionsController,
    public ethersProvider: IReadableCell<ethers.providers.Provider>,
  ) {}

  rpc = ensureType<PartialRpcImpl>()({
    eth_sendTransaction: async ({ providerId, params }) => {
      // TODO: If `origin === window.location.origin` (ie the tx is coming from
      // inside Quill), then we should really inline the information from the
      // dialog rather than using it.
      await this.InternalRpc().requestTransaction(...params);

      // FIXME: We should not be assuming that the first from is the same as all
      // the other froms!
      // Supporting multiple froms is actually super awesome - we can show off
      // client-side aggregation and implement contractless transaction pairs
      // (or rings!), ie account A sends asset X in exchange for account B
      // sending asset Y
      const { from } = params[0];

      const actions = params.map((tx) => ({
        ethValue: tx.value ?? '0',
        contractAddress: tx.to,
        encodedFunction: tx.data ?? '0x',
      }));

      const privateKey = await this.InternalRpc().lookupPrivateKey(from);

      const network = await this.networkController.network.read();

      const blsNetworkConfig = getBlsNetworkConfig(
        network,
        this.blsNetworksConfig,
      );

      const ethersProvider = await this.ethersProvider.read();

      const wallet = await BlsWalletWrapper.connect(
        privateKey,
        blsNetworkConfig.addresses.verificationGateway,
        ethersProvider,
      );

      const nonce = (await wallet.Nonce()).toString();
      const bundle = await wallet.sign({ nonce, actions });

      const aggregatorUrl =
        this.preferredAggregators[providerId] ?? network.aggregatorUrl;

      const agg = new Aggregator(aggregatorUrl);
      const result = await agg.add(bundle);

      assert(!('failures' in result), () => new Error(JSON.stringify(result)));

      this.knownTransactions[result.hash] = {
        ...params[0],
        nonce,
        value: params[0].value ?? '0',
        aggregatorUrl,
      };

      return result.hash;
    },
    eth_getTransactionByHash: async ({ params: [hash] }) => {
      const knownTx = this.knownTransactions[hash];

      if (knownTx === undefined) {
        return undefined;
      }

      // Here we're just relaying the information that we already know
      // internally about the transaction. ethers needs this response to
      // function properly.
      return {
        hash,
        from: knownTx.from,
        nonce: knownTx.nonce,
        value: knownTx.value,
        gasLimit: '0x0',
        data: knownTx.data ?? '0x',
      };
    },
    eth_getTransactionReceipt: async ({ params: [hash] }) => {
      const knownTx = this.knownTransactions[hash];

      if (knownTx === undefined) {
        return undefined;
      }

      const aggregator = new Aggregator(knownTx.aggregatorUrl);

      // FIXME: Aggregator/bls-wallet-clients: The response we're getting is
      // different from the type annotation.
      const bundleReceipt: unknown = await aggregator.lookupReceipt(hash);

      assertType(
        bundleReceipt,
        optional(
          io.type({
            transactionIndex: io.number,
            blockHash: io.string,
            blockNumber: io.number,
          }),
        ),
      );

      return (
        bundleReceipt && {
          transactionHash: hash,
          transactionIndex: bundleReceipt.transactionIndex,
          blockHash: bundleReceipt.blockHash,
          blockNumber: bundleReceipt.blockNumber,
          from: knownTx.from,
          to: knownTx.to,
          logs: [],
          cumulativeGasUsed: '0x0',
          gasUsed: '0x0',
          status: '0x1',
          effectiveGasPrice: '0x0',
        }
      );
    },
    eth_setPreferredAggregator: async ({
      providerId,
      params: [preferredAggregator],
    }) => {
      this.preferredAggregators[providerId] = preferredAggregator;
    },
  });
}
