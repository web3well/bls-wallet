import { FunctionComponent, useState } from 'react';
import { runtime } from 'webextension-polyfill';

// components, styles and UI
import { Check, X, CaretLeft, CaretRight } from 'phosphor-react';
import { ethers } from 'ethers';
import Button from '../components/Button';
import {
  PromptMessage,
  SendTransactionParams,
  TransactionStatus,
} from '../types/Rpc';
import TransactionCard from './TransactionCard';
import onAction from '../helpers/onAction';
import { useQuill } from '../QuillContext';
import useCell from '../cells/useCell';
import Loading from '../components/Loading';
import CurrencyDisplay from '../components/CurrencyDisplay';
import ChainCurrency from '../components/ChainCurrency';
import PreferredCurrency from '../components/PreferredCurrency';

const Confirm: FunctionComponent = () => {
  const quill = useQuill();

  const id = new URL(window.location.href).searchParams.get('id');
  const transactions = useCell(quill.cells.transactions);

  const [current, setCurrent] = useState<number>(0);

  if (transactions === undefined) {
    return <Loading />;
  }

  const tx = transactions.outgoing.find((t) => t.id === id);

  if (tx === undefined) {
    return <>Error: Tx not found</>;
  }

  const respondTx = (result: PromptMessage['result']) => {
    runtime.sendMessage(undefined, { id, result });
  };

  const nextTx = () => {
    setCurrent((current + 1) % tx.actions.length);
  };
  const prevTx = () => {
    setCurrent((current - 1) % tx.actions.length);
  };

  const calculateTotal = (allActions: SendTransactionParams[]) => {
    const total = allActions.reduce(
      (acc, cur) => acc.add(ethers.BigNumber.from(cur.value)),
      ethers.BigNumber.from(0),
    );
    return ethers.utils.formatEther(total);
  };

  return (
    <div className="flex flex-col justify-between h-screen bg-grey-200">
      <div className="p-4 flex justify-between text-white bg-blue-700">
        Transaction request
      </div>
      <div className="flex-grow p-4">
        <div className="">
          {/* site info */}
          <div className="flex gap-4">
            <div className="h-10 w-10 bg-grey-400 rounded-full" />
            <div className="leading-5">
              <div className="">AppName</div>
              <div className="text-blue-400">https://app-url.com/</div>
            </div>
          </div>
        </div>

        <div className="mt-4">AppName is making requests to your wallet</div>

        {tx.actions.length > 1 && (
          <div className="mt-4 flex justify-end text-body self-center gap-3">
            {current + 1} of {tx.actions?.length}
            <div
              className={[
                'bg-grey-400',
                'rounded-md',
                'p-1',
                'hover:bg-grey-500',
                'cursor-pointer',
              ].join(' ')}
              {...onAction(prevTx)}
            >
              <CaretLeft size={20} className="self-center" />
            </div>
            <div
              className={[
                'bg-grey-400',
                'rounded-md',
                'p-1',
                'hover:bg-grey-500',
                'cursor-pointer',
              ].join(' ')}
              {...onAction(nextTx)}
            >
              <CaretRight size={20} className="self-center" />
            </div>
          </div>
        )}

        <div className="flex flex-col">
          <div className="mt-4">
            {tx.actions[current] && (
              <TransactionCard {...tx.actions[current]} />
            )}
          </div>

          <div
            className={[
              'mt-4',
              'p-4',
              'bg-grey-300',
              'rounded-md',
              'grid',
              'gap-3',
            ].join(' ')}
            style={{
              gridTemplateColumns: '1fr auto auto 0.75rem auto auto',
              gridTemplateAreas: `
                "a1 b1 c1 . d1 e1"
                "a2 b2 c2 . d2 e2"
                "a3 a3 a3 a3 a3 a3"
                "a4 b4 c4 . d4 e4"
              `,
            }}
          >
            <div style={{ gridArea: 'a1' }}>Value</div>
            <div style={{ gridArea: 'b1' }} className="font-bold text-right">
              {calculateTotal(tx.actions)}
            </div>
            <div style={{ gridArea: 'c1' }}>
              <ChainCurrency />
            </div>
            <div style={{ gridArea: 'd1' }} className="font-bold text-right">
              <CurrencyDisplay
                chainValue={Number(calculateTotal(tx.actions))}
                includeLabel={false}
              />
            </div>
            <div style={{ gridArea: 'e1' }}>
              <PreferredCurrency />
            </div>

            <div style={{ gridArea: 'a2' }}>Fee</div>
            <div style={{ gridArea: 'b2' }} className="font-bold text-right">
              0
            </div>
            <div style={{ gridArea: 'c2' }}>
              <ChainCurrency />
            </div>
            <div style={{ gridArea: 'd2' }} className="font-bold text-right">
              <CurrencyDisplay chainValue={0} includeLabel={false} />
            </div>
            <div style={{ gridArea: 'e2' }}>
              <PreferredCurrency />
            </div>

            <div
              style={{ gridArea: 'a3' }}
              className="border-b border-grey-500"
            />

            <div style={{ gridArea: 'a4' }}>Total</div>
            <div style={{ gridArea: 'b4' }} className="font-bold text-right">
              {calculateTotal(tx.actions)}
            </div>
            <div style={{ gridArea: 'c4' }}>
              <ChainCurrency />
            </div>
            <div style={{ gridArea: 'd4' }} className="font-bold text-right">
              <CurrencyDisplay
                chainValue={Number(calculateTotal(tx.actions))}
                includeLabel={false}
              />
            </div>
            <div style={{ gridArea: 'e4' }}>
              <PreferredCurrency />
            </div>
          </div>
        </div>
      </div>
      <div className="flex bg-white p-4 justify-between">
        <Button
          className="btn-secondary"
          onPress={() => respondTx(TransactionStatus.REJECTED)}
        >
          <div className="flex justify-between gap-3">
            Reject All <X size={20} className="self-center" />
          </div>
        </Button>

        <Button
          className="btn-primary"
          onPress={() => respondTx(TransactionStatus.APPROVED)}
        >
          <div className="flex justify-between gap-3">
            Confirm All <Check size={20} className="self-center" />
          </div>
        </Button>
      </div>
    </div>
  );
};

export default Confirm;
