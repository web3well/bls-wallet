import { EventEmitter } from 'events';

import * as io from 'io-ts';
import {
  createEngineStream,
  createLoggerMiddleware,
  JRPCEngine,
  setupMultiplex,
  Substream,
} from '@toruslabs/openlogin-jrpc';
import pump from 'pump';
import type { Duplex } from 'readable-stream';

import { Runtime } from 'webextension-polyfill';
import { Aggregator } from 'bls-wallet-clients';
import TypedEventEmitter from 'typed-emitter';
import { createRandomId, getAllReqParam, getUserLanguage } from './utils';
import NetworkController from './Network/NetworkController';
import CurrencyController, {
  CurrencyControllerConfig,
} from './CurrencyController';
import KeyringController from './KeyringController';
import PreferencesController from './PreferencesController';
import { providerAsMiddleware } from './Network/INetworkController';
import {
  IProviderHandlers,
  SendTransactionParams,
} from './Network/createEthMiddleware';
import { createOriginMiddleware } from './Network/createOriginMiddleware';
import createTabIdMiddleware from './rpcHelpers/TabIdMiddleware';
import { AGGREGATOR_URL } from '../env';
import knownTransactions from './knownTransactions';
import CellCollection from '../cells/CellCollection';
import mapValues from '../helpers/mapValues';
import ExplicitAny from '../types/ExplicitAny';
import Rpc, {
  EventsPortInfo,
  Notification,
  NotificationEventName,
  PrivateRpc,
  PrivateRpcMessage,
  PrivateRpcMethodName,
  PublicRpc,
  PublicRpcMessage,
  PublicRpcMethodName,
  PublicRpcWithOrigin,
  rpcMap,
  RpcResult,
  SetEventEnabledMessage,
  toRpcResult,
} from '../types/Rpc';
import assertType from '../cells/assertType';
import TimeCell from '../cells/TimeCell';
import QuillCells from '../QuillCells';
import isType from '../cells/isType';
import toOkError from '../helpers/toOkError';

const PROVIDER = 'quill-provider';

export default class QuillController
  implements PublicRpcWithOrigin, PrivateRpc
{
  events = new EventEmitter() as TypedEventEmitter<{
    notification(notification: Notification): void;
  }>;

  public connections: Record<string, Record<string, { engine: JRPCEngine }>> =
    {};

  private _isClientOpen = false;

  private networkController: NetworkController;
  private currencyController: CurrencyController;
  private keyringController: KeyringController;
  private preferencesController: PreferencesController;

  // This is just kept in memory because it supports setting the preferred
  // aggregator for the particular tab only.
  private tabPreferredAggregators: Record<number, string> = {};

  public time = TimeCell(1000);
  public cells: QuillCells;

  constructor(
    public storage: CellCollection,
    public currencyControllerConfig: CurrencyControllerConfig,
  ) {
    this.cells = QuillCells(storage);

    this.networkController = new NetworkController(
      this.cells.network,
      this.time,
      this.makeEthereumMethods(),
    );

    this.currencyController = new CurrencyController(
      this.currencyControllerConfig,
      this.cells.preferredCurrency,
      this.networkController.ticker,
    );

    this.keyringController = new KeyringController(this.cells.keyring);

    this.preferencesController = new PreferencesController(
      this.cells.preferences,
    );

    this.watchThings();
  }

  /** Private RPC */

  async setSelectedAddress(newSelectedAddress: string) {
    this.preferencesController.update({
      selectedAddress: newSelectedAddress,
    });

    return 'ok' as const;
  }

  async createHDAccount() {
    return this.keyringController.createHDAccount();
  }

  async isOnboardingComplete() {
    return this.keyringController.isOnboardingComplete();
  }

  async setHDPhrase(phrase: string) {
    this.keyringController.setHDPhrase(phrase);
    return 'ok' as const;
  }

  /** Public RPC */

  // eslint-disable-next-line no-empty-pattern
  async eth_accounts(origin: string, []) {
    if (origin === window.location.origin) {
      return (await this.keyringController.state.read()).wallets.map(
        ({ address }) => address,
      );
    }

    const selectedAddress =
      await this.preferencesController.selectedAddress.read();

    // TODO (merge-ok) Expose no accounts if this origin has not been approved,
    // preventing account-requiring RPC methods from completing successfully
    // only show address if account is unlocked
    // https://github.com/web3well/bls-wallet/issues/224
    return selectedAddress ? [selectedAddress] : [];
  }

  // eslint-disable-next-line no-empty-pattern
  async eth_requestAccounts(origin: string, []) {
    const selectedAddress =
      await this.preferencesController.selectedAddress.read();
    const accounts = selectedAddress ? [selectedAddress] : [];
    this.events.emit('notification', {
      type: 'quill-notification',
      origin,
      eventName: 'unlockStateChanged',
      value: {
        accounts,
        isUnlocked: accounts.length > 0,
      },
    });
    return accounts;
  }

  async debugMe(_origin: string, [a, b, c]: Parameters<PublicRpc['debugMe']>) {
    console.log('debugMe', { a, b, c });
    return 'ok' as const;
  }

  async quill_breakOnAssertionFailures(
    _origin: string,
    [differentFrom]: Parameters<PublicRpc['quill_breakOnAssertionFailures']>,
  ) {
    for await (const preferences of this.cells.preferences) {
      const setting = preferences.breakOnAssertionFailures ?? false;

      if (differentFrom !== setting) {
        return setting;
      }
    }

    throw new Error('Unexpected end of this.cells.preferences');
  }

  handleMessage(message: unknown): Promise<RpcResult<unknown>> | undefined {
    if (PublicRpcMessage.is(message)) {
      return toOkError(async () => {
        if (isType(message.method, PublicRpcMethodName)) {
          assertType(message.method, PublicRpcMethodName);

          assertType(
            message.params,
            rpcMap.public[message.method].params as io.Type<ExplicitAny>,
          );

          return (this[message.method] as ExplicitAny)(
            message.origin,
            message.params,
          ) as unknown;
        }

        return this.networkController.fetch(message);
      }).then(toRpcResult);
    }

    if (PrivateRpcMessage.is(message)) {
      return toOkError(async () => {
        assertType(message.method, PrivateRpcMethodName);

        assertType(
          message.params,
          rpcMap.private[message.method].params as io.Type<ExplicitAny>,
        );

        return (this[message.method] as ExplicitAny)(...message.params);
      }).then(toRpcResult);
    }

    // It's important to return undefined synchronously because messages can
    // have multiple handlers and if you return a promise you are taking
    // ownership of replying to that message. If multiple handlers return
    // promises then the browser will just provide the caller with null.
    return undefined;
  }

  handlePort(port: Runtime.Port) {
    const parseResult = toOkError(() => JSON.parse(port.name) as unknown);

    if ('error' in parseResult || !isType(parseResult.ok, EventsPortInfo)) {
      return;
    }

    const eventsPortInfo = parseResult.ok;

    const enabledEvents = new Set<NotificationEventName>();

    port.onMessage.addListener((message) => {
      assertType(message, SetEventEnabledMessage);

      if (message.enabled) {
        enabledEvents.add(message.eventName);
      } else {
        enabledEvents.delete(message.eventName);
      }
    });

    const notificationListener = (notification: Notification) => {
      const originMatch =
        notification.origin === '*' ||
        notification.origin === eventsPortInfo.origin;

      if (originMatch && enabledEvents.has(notification.eventName)) {
        port.postMessage(notification);
      }
    };

    this.events.on('notification', notificationListener);

    port.onDisconnect.addListener(() => {
      this.events.off('notification', notificationListener);
    });
  }

  /**
   * A method for recording whether the Quill user interface is open or not.
   */
  set isClientOpen(open: boolean) {
    this._isClientOpen = open;
    console.log(this._isClientOpen, 'set client open status');
  }

  async addAccount(privKey: string): Promise<string> {
    const address = await this.keyringController.importAccount(privKey);
    const locale = getUserLanguage();
    this.preferencesController.createUser({
      address,
      locale,
      selectedCurrency: 'USD',
      theme: 'light',
    });
    return address;
  }

  /**
   * Used to create a multiplexed stream for connecting to an untrusted context
   * like a Dapp or other extension.
   */
  setupUnTrustedCommunication(
    connectionStream: Duplex,
    sender: Runtime.MessageSender | undefined,
  ): void {
    // connect features && for test cases
    const quillMux = setupMultiplex(connectionStream);
    // We create the mux so that we can handle phishing stream here
    const providerStream = quillMux.getStream(PROVIDER);
    this.setupProviderConnection(providerStream as Substream, sender, false);
  }

  /**
   * A method for serving our ethereum provider over a given stream.
   */
  setupProviderConnection(
    outStream: Substream,
    sender?: Runtime.MessageSender,
    isInternal = true,
  ) {
    let origin = '';
    if (isInternal) {
      origin = 'quill';
    } else {
      const senderUrl = sender?.url;
      if (!senderUrl) throw new Error('Need a valid origin to connect to');
      origin = new URL(senderUrl).origin;
    }

    let tabId;
    if (sender?.tab?.id) {
      tabId = sender.tab.id;
    }

    const engine = this.setupProviderEngine({
      origin,
      tabId,
    });

    // setup connection
    const providerStream = createEngineStream({ engine });

    const connectionId = this.addConnection(origin, { engine });

    pump(outStream, providerStream, outStream, (err) => {
      // handle any middleware cleanup
      if (connectionId) this.removeConnection(origin, connectionId);
      if (err) {
        console.error(err);
      }
    });
  }

  setupProviderEngine({
    origin,
    tabId,
  }: {
    origin: string;
    tabId?: number;
  }): JRPCEngine {
    // setup json rpc engine stack
    const engine = new JRPCEngine();
    const provider = this.networkController._providerProxy;
    console.log('setting up provider engine', origin, provider);

    // append origin to each request
    engine.push(createOriginMiddleware({ origin }));
    // append tabId to each request if it exists
    if (tabId) {
      engine.push(createTabIdMiddleware({ tabId }));
    }
    // logging
    engine.push(createLoggerMiddleware(console));

    // forward to Quill primary provider
    engine.push(providerAsMiddleware(provider));
    return engine;
  }

  private makeEthereumMethods(): IProviderHandlers {
    return {
      // account management

      eth_coinbase: async () =>
        (await this.preferencesController.selectedAddress.read()) || null,

      wallet_get_provider_state: async () => {
        const selectedAddress =
          await this.preferencesController.selectedAddress.read();

        return {
          accounts: selectedAddress ? [selectedAddress] : [],
          chainId: (await this.networkController.state.read()).chainId,
          isUnlocked: !!selectedAddress,
        };
      },

      eth_setPreferredAggregator: async (req: any) => {
        // eslint-disable-next-line prefer-destructuring
        this.tabPreferredAggregators[req.tabId] = req.params[0];

        return 'ok';
      },

      eth_sendTransaction: async (req: any) => {
        const txParams = getAllReqParam<SendTransactionParams[]>(req);
        const { from } = txParams[0];

        const actions = txParams.map((tx) => {
          return {
            ethValue: tx.value || '0',
            contractAddress: tx.to,
            encodedFunction: tx.data,
          };
        });

        const nonce = await this.keyringController.getNonce(from);
        const tx = {
          nonce: nonce.toString(),
          actions,
        };

        const bundle = await this.keyringController.signTransactions(from, tx);
        const aggregatorUrl =
          this.tabPreferredAggregators[req.tabId] ?? AGGREGATOR_URL;
        const agg = new Aggregator(aggregatorUrl);
        const result = await agg.add(bundle);

        if ('failures' in result) {
          throw new Error(JSON.stringify(result.failures));
        }

        knownTransactions[result.hash] = {
          ...txParams[0],
          nonce: nonce.toString(),
          value: txParams[0].value || '0',
          aggregatorUrl,
        };

        return result.hash;
      },

      ...this.makePublicRpc(),
    };
  }

  private makePublicRpc(): Record<string, unknown> {
    type MethodsWithOrigin = {
      [M in keyof Rpc['public']]: (
        origin: string,
        params: Parameters<Rpc['public'][M]>,
      ) => ReturnType<Rpc['public'][M]>;
    };

    const methods: MethodsWithOrigin = {
      eth_accounts: this.eth_accounts.bind(this),
      eth_requestAccounts: this.eth_requestAccounts.bind(this),
      debugMe: this.debugMe.bind(this),
      quill_breakOnAssertionFailures:
        this.quill_breakOnAssertionFailures.bind(this),
    };

    return mapValues(methods, (method, methodName) => (req: any) => {
      const params = req.params ?? [];
      assertType(
        params,
        rpcMap.public[methodName].params as io.Type<ExplicitAny>,
      );
      return (method as ExplicitAny)(req.origin, params);
    });
  }

  /**
   * Adds a reference to a connection by origin. Ignores the 'quill' origin.
   * Caller must ensure that the returned id is stored such that the reference
   * can be deleted later.
   */
  addConnection(
    origin: string,
    { engine }: { engine: JRPCEngine },
  ): string | null {
    if (origin === 'quill') {
      return null;
    }

    if (!this.connections[origin]) {
      this.connections[origin] = {};
    }

    const id = createRandomId();
    this.connections[origin][id] = {
      engine,
    };

    return id;
  }

  /**
   * Deletes a reference to a connection, by origin and id.
   * Ignores unknown origins.
   */
  removeConnection(origin: string, id: string) {
    const connections = this.connections[origin];
    if (!connections) {
      return;
    }

    delete connections[id];

    if (Object.keys(connections).length === 0) {
      delete this.connections[origin];
    }
  }

  /**
   * Causes the RPC engines associated with the connections to the given origin
   * to emit a notification event with the given payload.
   *
   * The caller is responsible for ensuring that only permitted notifications
   * are sent.
   *
   * Ignores unknown origins.
   */
  notifyConnections(origin: string, payload: unknown) {
    const connections = this.connections[origin];

    if (connections) {
      Object.values(connections).forEach((conn) => {
        if (conn.engine) {
          conn.engine.emit('notification', payload);
        }
      });
    }
  }

  /**
   * Causes the RPC engines associated with all connections to emit a
   * notification event with the given payload.
   *
   * If the "payload" parameter is a function, the payload for each connection
   * will be the return value of that function called with the connection's
   * origin.
   *
   * The caller is responsible for ensuring that only permitted notifications
   * are sent.
   *
   */
  notifyAllConnections(payload: unknown) {
    const getPayload =
      typeof payload === 'function'
        ? (origin: string) => payload(origin)
        : () => payload;

    Object.keys(this.connections).forEach((origin) => {
      Object.values(this.connections[origin]).forEach(async (conn) => {
        if (conn.engine) {
          conn.engine.emit('notification', await getPayload(origin));
        }
      });
    });
  }

  private watchThings() {
    (async () => {
      for await (const chainId of this.networkController.chainId) {
        // TODO: We might need to avoid emitting notifications for the first
        // values of these cells. It would only matter if a page is able to
        // connect before we get the first value. (Which seems unlikely, but it
        // might be worth tidying this up anyway).
        this.events.emit('notification', {
          type: 'quill-notification',
          origin: '*',
          eventName: 'chainChanged',
          value: chainId,
        });
      }
    })();

    (async () => {
      const storedBlockNumber = this.storage.Cell(
        'block-number',
        io.number,
        () => this.networkController.blockNumber.read(),
      );

      for await (const blockNumber of this.networkController.blockNumber) {
        await storedBlockNumber.write(blockNumber);
      }
    })();

    (async () => {
      for await (const userCurrency of this.currencyController.userCurrency) {
        await this.currencyController.updateConversionRate();
        this.preferencesController.setSelectedCurrency(userCurrency);
      }
    })();

    (async () => {
      for await (const selectedAddress of this.preferencesController
        .selectedAddress) {
        this.events.emit('notification', {
          type: 'quill-notification',
          origin: '*',
          eventName: 'accountsChanged',
          value: selectedAddress ? [selectedAddress] : [],
        });
      }
    })();

    (async () => {
      window.ethereum ??= { breakOnAssertionFailures: false };

      while (true) {
        window.ethereum.breakOnAssertionFailures =
          await this.quill_breakOnAssertionFailures(window.location.origin, [
            window.ethereum.breakOnAssertionFailures,
          ]);
      }
    })();
  }
}
