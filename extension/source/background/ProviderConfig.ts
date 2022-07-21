import * as io from 'io-ts';

export const ProviderConfig = io.type({
  /**
   * Block explorer url for the chain
   * @example https://ropsten.etherscan.io
   */
  blockExplorerUrl: io.string,
  /**
   * Logo url for the base token
   */
  logo: io.string,
  /**
   * @example 'Binance Token', 'Ether', 'Matic Network Token'
   */
  chainCurrencyName: io.string,
  /**
   * @example BNB, ETH
   */
  chainCurrency: io.string,
  /**
   * RPC target Url for the chain
   * @example https://ropsten.infura.io/v3/YOUR_API_KEY
   */
  rpcTarget: io.string,
  /**
   * Chain Id parameter(hex with 0x prefix) for the network. Mandatory for all
   * networks. (assign one with a map to network identifier for platforms)
   * @example 0x1 for mainnet, 'loading' if not connected to anything yet or
   *          connection fails
   * @defaultValue 'loading'
   */
  chainId: io.string,
  /**
   * Display name for the network
   */
  displayName: io.string,
  /**
   * The base url of an aggregator api enabling BLS signature aggregation with
   * bundles from other users.
   */
  aggregatorUrl: io.string,
  /**
   * Unique key for network (used for infura)
   */
  networkKey: io.string,
});

export type ProviderConfig = io.TypeOf<typeof ProviderConfig>;
