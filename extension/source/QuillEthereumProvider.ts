import { ethers } from 'ethers';
import { EventEmitter } from 'events';

import * as io from 'io-ts';
import TypedEventEmitter from 'typed-emitter';

import assertType from './cells/assertType';
import { FormulaCell } from './cells/FormulaCell';
import isType from './cells/isType';
import LongPollingCell from './cells/LongPollingCell';
import { RandomId } from './background/utils';
import { ProviderState, RpcMessage, RpcResponse } from './types/Rpc';

// TODO: Move inside Rpc.ts / deduplicate
const RequestBody = io.type({
  method: io.string,
  params: io.union([io.undefined, io.array(io.unknown)]),
});

export default class QuillEthereumProvider
  extends (EventEmitter as new () => TypedEventEmitter<{
    accountsChanged(accounts: string[]): void;
    chainChanged(chainId: string): void;
    connect(connection: { chainId: string }): void;
    disconnect(disconnectionMessage: {
      message: string;
      code: number;
      data?: unknown;
    }): void;
  }>)
  implements ethers.providers.ExternalProvider
{
  isQuill = true;
  breakOnAssertionFailures = false;

  constructor() {
    super();

    // TODO: Generalize this
    const state = LongPollingCell<ProviderState>(
      (opt) =>
        this.request({
          method: 'quill_providerState',
          params: [opt ?? null],
        }) as Promise<ProviderState>, // TODO: Avoid cast
    );

    const chainId = FormulaCell.Sub(state, 'chainId');
    const selectedAddress = FormulaCell.Sub(state, 'selectedAddress');

    const breakOnAssertionFailures = FormulaCell.Sub(
      state,
      'breakOnAssertionFailures',
    );

    (async () => {
      let connected = false;

      for await (const $chainId of chainId) {
        if (!connected) {
          connected = true;
          this.emit('connect', { chainId: $chainId });
        }

        this.emit('chainChanged', $chainId);
      }

      // FIXME: We're not reaching this because the chainId cell is not ending
      // like it should.
      this.emit('disconnect', {
        message: 'disconnected',
        code: 4900,
        data: undefined,
      });
    })();

    // TODO: Add .forEach to IReadable cell to simplify this use-case
    (async () => {
      for await (const $selectedAddress of selectedAddress) {
        this.emit(
          'accountsChanged',
          $selectedAddress ? [$selectedAddress] : [],
        );
      }
    })();

    (async () => {
      for await (const $breakOnAssertionFailures of breakOnAssertionFailures) {
        this.breakOnAssertionFailures = $breakOnAssertionFailures;
      }
    })();
  }

  // TODO: Expose better type information
  async request(body: unknown) {
    // TODO: Ensure all errors are EthereumRpcError, maybe making use of
    // the ethereum-rpc-error module.

    assertType(body, RequestBody);

    const id = RandomId();

    const message: Omit<RpcMessage, 'providerId' | 'origin'> = {
      type: 'quill-rpc',
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

    window.postMessage(message, '*');

    return await new Promise((resolve, reject) => {
      const messageListener = (evt: MessageEvent<unknown>) => {
        if (!isType(evt.data, RpcResponse) || evt.data.id !== id) {
          return;
        }

        window.removeEventListener('message', messageListener);

        if ('ok' in evt.data.result) {
          resolve(evt.data.result.ok);
        } else if ('error' in evt.data.result) {
          const error = new Error(evt.data.result.error.message);
          error.stack = evt.data.result.error.stack;
          reject(error);
        }
      };

      window.addEventListener('message', messageListener);
    });
  }

  // TODO: Expose .rpc here (only for quill page and maybe all pages if it's
  // configured to be turned on)
}