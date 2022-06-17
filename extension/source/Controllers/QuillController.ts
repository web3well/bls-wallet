/* eslint-disable no-empty-pattern */

import { EventEmitter } from 'events';

import * as io from 'io-ts';
import { Runtime } from 'webextension-polyfill';
import { Aggregator } from 'bls-wallet-clients';
import TypedEventEmitter from 'typed-emitter';

import { getAllReqParam, getUserLanguage } from './utils';
import NetworkController from './Network/NetworkController';
import CurrencyController, {
  CurrencyControllerConfig,
} from './CurrencyController';
import KeyringController from './KeyringController';
import PreferencesController from './PreferencesController';
import {
  IProviderHandlers,
  SendTransactionParams,
} from './Network/createEthMiddleware';
import { AGGREGATOR_URL } from '../env';
import knownTransactions from './knownTransactions';
import CellCollection from '../cells/CellCollection';
import ExplicitAny from '../types/ExplicitAny';
import {
  EventsPortInfo,
  Notification,
  NotificationEventName,
  PrivateRpc,
  PrivateRpcMessage,
  PrivateRpcMethodName,
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

export default class QuillController {
  events = new EventEmitter() as TypedEventEmitter<{
    notification(notification: Notification): void;
  }>;

  networkController: NetworkController;
  currencyController: CurrencyController;
  keyringController: KeyringController;
  preferencesController: PreferencesController;

  // This is just kept in memory because it supports setting the preferred
  // aggregator for the particular tab only.
  tabPreferredAggregators: Record<number, string> = {};

  time = TimeCell(1000);
  cells: QuillCells;

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

  privateRpc: PrivateRpc = {
    setSelectedAddress: async (newSelectedAddress) => {
      this.preferencesController.update({
        selectedAddress: newSelectedAddress,
      });

      return 'ok';
    },

    createHDAccount: async () => {
      return this.keyringController.createHDAccount();
    },

    isOnboardingComplete: async () => {
      return this.keyringController.isOnboardingComplete();
    },

    setHDPhrase: async (phrase) => {
      this.keyringController.setHDPhrase(phrase);
      return 'ok';
    },
  };

  publicRpc: PublicRpcWithOrigin = {
    eth_accounts: async (origin, []) => {
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
    },

    eth_requestAccounts: async (origin, []) => {
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
    },

    debugMe: async (_origin, [a, b, c]) => {
      console.log('debugMe', { a, b, c });
      return 'ok' as const;
    },

    quill_breakOnAssertionFailures: async (_origin, [differentFrom]) => {
      for await (const preferences of this.cells.preferences) {
        const setting = preferences.breakOnAssertionFailures ?? false;

        if (differentFrom !== setting) {
          return setting;
        }
      }

      throw new Error('Unexpected end of this.cells.preferences');
    },
  };

  handleMessage(message: unknown): Promise<RpcResult<unknown>> | undefined {
    // TODO: Logging
    // - Don't just log here, also log the same way in page (only include
    //   messages relevant to that page)
    // - Make this configurable in Developer Settings

    if (PublicRpcMessage.is(message)) {
      return toOkError(async () => {
        if (isType(message.method, PublicRpcMethodName)) {
          assertType(message.method, PublicRpcMethodName);

          assertType(
            message.params,
            rpcMap.public[message.method].params as io.Type<ExplicitAny>,
          );

          return (this.publicRpc[message.method] as ExplicitAny)(
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

        return (this.privateRpc[message.method] as ExplicitAny)(
          ...message.params,
        );
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

  private makeEthereumMethods(): IProviderHandlers {
    // TODO: Move these to publicRpc
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
    };
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
          await this.publicRpc.quill_breakOnAssertionFailures(
            window.location.origin,
            [window.ethereum.breakOnAssertionFailures],
          );
      }
    })();
  }
}
