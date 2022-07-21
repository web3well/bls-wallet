import * as io from 'io-ts';

import { EventEmitter } from 'events';
import TypedEventEmitter from 'typed-emitter';
import assertType from './cells/assertType';
import forEach from './cells/forEach';

import { FormulaCell } from './cells/FormulaCell';
import isType from './cells/isType';
import mapValues from './helpers/mapValues';
import RandomId from './helpers/RandomId';
import {
  assertEthereumRequestBody,
  EthereumRequestBody,
  RpcClient,
  RpcMap,
  rpcMap,
  RpcRequest,
  RpcMethodName,
  RpcResponse,
} from './types/Rpc';
import ExplicitAny from './types/ExplicitAny';
import { assertConfig } from './helpers/assert';
import QuillLongPollingCell from './QuillLongPollingCell';

/**
 * This is Quill's definition of window.ethereum.
 */
export default class QuillEthereumProvider extends (EventEmitter as new () => TypedEventEmitter<{
  accountsChanged(accounts: string[]): void;
  chainChanged(chainId: string): void;
  connect(connection: { chainId: string }): void;
  disconnect(disconnectionMessage: {
    message: string;
    code: number;
    data?: unknown;
  }): void;
}>) {
  isQuill = true;
  rpc?: RpcClient;
  #isQuillExtensionPage: boolean;
  #shouldLog = false;

  constructor(isQuillExtensionPage = false) {
    super();

    this.#isQuillExtensionPage = isQuillExtensionPage;

    if (this.#isQuillExtensionPage) {
      this.#exposeRpc();
    }

    const state = QuillLongPollingCell(this, 'providerState');

    const chainId = FormulaCell.Sub(state, 'chainId');

    const selectedAddress = new FormulaCell({ state }, ({ $state }) => {
      if ($state.selectedPublicKeyHash === undefined) {
        return undefined;
      }

      return this.request({
        method: 'pkHashToAddress',
        params: [$state.selectedPublicKeyHash],
      });
    });

    const developerSettings = FormulaCell.Sub(state, 'developerSettings');

    let connected = false;

    forEach(chainId, ($chainId) => {
      if (!connected) {
        connected = true;
        this.emit('connect', { chainId: $chainId });
        // TODO: Also implement disconnect event
      }

      this.emit('chainChanged', $chainId);
    });

    forEach(selectedAddress, ($selectedAddress) =>
      this.emit('accountsChanged', $selectedAddress ? [$selectedAddress] : []),
    );

    forEach(
      developerSettings,
      ({ breakOnAssertionFailures, exposeEthereumRpc, rpcLogging }) => {
        assertConfig.breakOnFailures = breakOnAssertionFailures;

        const shouldExposeEthereumRpc =
          exposeEthereumRpc || this.#isQuillExtensionPage;

        const ethereumRpcExposed = this.rpc !== undefined;

        if (ethereumRpcExposed !== shouldExposeEthereumRpc) {
          if (shouldExposeEthereumRpc) {
            this.#exposeRpc();
          } else {
            delete this.rpc;
          }
        }

        this.#shouldLog = rpcLogging.inPage;
      },
    );
  }

  request<M extends string>(
    body: EthereumRequestBody<M>,
  ): Promise<
    M extends RpcMethodName ? io.TypeOf<RpcMap[M]['Response']> : unknown
  > {
    assertEthereumRequestBody(body);

    const response = (async () => {
      const id = RandomId();

      const request: Omit<RpcRequest, 'providerId' | 'origin'> = {
        type: 'quill-rpc-request',
        id,
        // Note: We do not set providerId or origin here because our code is
        // co-mingled with the dApp and is therefore untrusted. Instead, the
        // content script will add these fields before passing them along to the
        // background script.
        // providerId: this.id,
        // origin: window.location.origin,
        method: body.method,
        params: body.params ?? [],
      };

      window.postMessage(request, '*');

      const backgroundResponse = await new Promise((resolve, reject) => {
        const responseListener = (evt: MessageEvent<unknown>) => {
          if (!isType(evt.data, RpcResponse) || evt.data.id !== id) {
            return;
          }

          window.removeEventListener('message', responseListener);

          if (!('error' in evt.data.result)) {
            resolve(evt.data.result.ok);
          } else {
            const error = new Error(evt.data.result.error.message);
            (error as unknown as { code: number }).code =
              evt.data.result.error.code;
            error.stack = evt.data.result.error.stack;
            reject(error);
          }
        };

        window.addEventListener('message', responseListener);
      });

      if (isType(body.method, RpcMethodName)) {
        assertType(
          backgroundResponse,
          rpcMap[body.method].Response as io.Type<unknown>,
        );
      }

      return backgroundResponse as ExplicitAny;
    })();

    if (this.#shouldLog) {
      if (this.rpc && body.method in this.rpc) {
        console.log(
          // Ok, we might be lying a bit here. We're logging the ethereum.rpc
          // version of the call regardless of which version was actually used.
          // This is to help raise awareness of the proposed ethereum.rpc way of
          // doing things.
          `ethereum.rpc.${body.method}(${(body.params ?? [])
            .map((p) => JSON.stringify(p))
            .join(', ')}) ->`,
          response,
        );
      } else {
        console.log(
          `ethereum.request({\n  method: ${JSON.stringify(
            body.method,
          )},\n  params: [${(body.params ?? [])
            .map((p) => JSON.stringify(p))
            .join(', ')}],\n}) ->`,
          response,
        );
      }
    }

    return response;
  }

  #exposeRpc() {
    this.rpc = mapValues(
      rpcMap,
      (_, method) =>
        (...params: unknown[]) =>
          this.request({
            method,
            params,
          } as EthereumRequestBody<string>),
    ) as RpcClient;
  }
}
