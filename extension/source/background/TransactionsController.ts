import { windows, runtime } from 'webextension-polyfill';
import ensureType from '../helpers/ensureType';
import QuillStorageCells from '../QuillStorageCells';
import {
  PartialRpcImpl,
  PromptMessage,
  QuillTransaction,
  RpcClient,
  TransactionStatus,
} from '../types/Rpc';
import assert from '../helpers/assert';
import TaskQueue from '../helpers/TaskQueue';
import RandomId from '../helpers/RandomId';
import isType from '../cells/isType';

export default class TransactionsController {
  constructor(
    public InternalRpc: () => RpcClient,
    public transactions: QuillStorageCells['transactions'],
  ) {}

  rpc = ensureType<PartialRpcImpl>()({
    promptUser: async ({ params: [id] }) => {
      const cleanupTasks = new TaskQueue();

      const promptAction = new Promise<
        TransactionStatus.APPROVED | TransactionStatus.REJECTED
      >((resolve, _reject) => {
        (async () => {
          const lastWin = await windows.getLastFocused();

          const popupWidth = 400;
          let left: number | undefined;

          if (lastWin.width !== undefined && lastWin.left !== undefined) {
            left = lastWin.left + lastWin.width - popupWidth - 20;
          }

          const popup = await windows.create({
            url: runtime.getURL(`confirm.html?id=${id}`),
            type: 'popup',
            width: popupWidth,
            height: 700,
            left,
          });

          cleanupTasks.push(() => {
            if (popup.id !== undefined) {
              windows.remove(popup.id);
            }
          });

          function onRemovedListener(windowId: number) {
            if (windowId === popup.id) {
              resolve(TransactionStatus.REJECTED);
            }
          }

          windows.onRemoved.addListener(onRemovedListener);

          cleanupTasks.push(() => {
            windows.onRemoved.removeListener(onRemovedListener);
          });

          function messageListener(message: unknown) {
            if (!isType(message, PromptMessage) || message.id !== id) {
              return;
            }

            resolve(message.result);
          }

          runtime.onMessage.addListener(messageListener);
        })();
      });

      promptAction.finally(() => cleanupTasks.run());
      return promptAction;
    },

    createTransaction: async ({ params }) => {
      const id = RandomId();

      assert(params.length > 0);
      const { from } = params[0];

      assert(
        params.every((p) => p.from === from),
        () => new Error('Attempt to create transaction with multiple froms'),
      );

      const newTransaction: QuillTransaction = {
        id,
        chainId: await this.InternalRpc().eth_chainId(),
        from,
        createdAt: +new Date(),
        status: TransactionStatus.NEW,
        bundleHash: '',
        actions: params.map((p) => ({
          ...p,
          value: p.value || '0x0',
          gasPrice: p.gasPrice || '0x0',
        })),
      };

      const { outgoing: transactions } = await this.transactions.read();

      assert(
        transactions.every((t) => t.id !== id),
        () => new Error('Transaction already exists'),
      );

      transactions.push(newTransaction);
      await this.transactions.update({ outgoing: transactions });
      return id;
    },

    requestTransaction: async ({ params }) => {
      const id = await this.InternalRpc().createTransaction(...params);
      const userAction = await this.InternalRpc().promptUser(id);

      await this.InternalRpc().updateTransactionStatus(id, userAction);

      if (userAction !== TransactionStatus.APPROVED) {
        throw new Error('User did not approve the transaction');
      }

      return id;
    },

    getTransactionById: async ({ params: [id] }) => {
      const { outgoing: transactions } = await this.transactions.read();
      const transaction = transactions.find((t) => t.id === id);

      if (transaction) {
        return transaction;
      }

      throw new Error('Transaction not found');
    },

    getTransactionByHash: async ({ params: [hash] }) => {
      const { outgoing: transactions } = await this.transactions.read();
      const transaction = transactions.find((t) => t.bundleHash === hash);

      if (transaction) {
        return transaction;
      }
      throw new Error('Transaction not found');
    },

    updateTransactionStatus: async ({ params: [id, status] }) => {
      const { outgoing: transactions } = await this.transactions.read();
      const transaction = transactions.find((t) => t.id === id);

      assert(
        transaction !== undefined,
        () => new Error('Transaction not found'),
      );

      const validTransitions: Partial<
        Record<TransactionStatus, TransactionStatus[]>
      > = {
        [TransactionStatus.NEW]: [
          TransactionStatus.APPROVED,
          TransactionStatus.REJECTED,
        ],
        [TransactionStatus.APPROVED]: [
          TransactionStatus.CANCELLED,
          TransactionStatus.APPROVED,
          TransactionStatus.FAILED,
        ],
      };

      const currentValidTransitions =
        validTransitions[transaction.status] ?? [];

      assert(
        currentValidTransitions.includes(status),
        () =>
          new Error(
            [
              'Forbidden transaction status transition:',
              `${transaction.status} -> ${status}`,
            ].join(' '),
          ),
      );

      transaction.status = status;

      const updatedTx = transactions.filter((t) => t.id !== id);
      updatedTx.push(transaction);
      await this.transactions.update({ outgoing: updatedTx });
    },
  });
}
