import { FunctionComponent } from 'react';
import useCell from '../../../cells/useCell';
import Button from '../../../components/Button';
import Loading from '../../../components/Loading';
import { useQuill } from '../../../QuillContext';
/* eslint import/no-cycle: "warn" -- TODO (merge-ok) Fix import cycle */
import { WalletSummary } from './WalletSummary';

export interface IWallet {
  address: string;
  name: string;
  networks: number;
  tokens: number;
}

export const WalletsWrapper: FunctionComponent = () => {
  const quill = useQuill();
  const { rpc } = quill;

  // TODO: Add useQuillCells convenience api.
  const ethAccounts = useCell(quill.cells.ethAccounts);
  const selectedAddress = useCell(quill.cells.selectedAddress);

  return (
    <div className="">
      <div className="flex justify-between place-items-center">
        <div className="text-body">Wallets</div>
        <Button onPress={rpc.addHDAccount} className="btn-secondary">
          Add
        </Button>
      </div>

      {!ethAccounts && <Loading />}
      {ethAccounts && (
        <div className="flex flex-col gap-6 mt-8">
          {ethAccounts.map((address, index) => (
            <WalletSummary
              onAction={() => rpc.setSelectedAddress(address)}
              key={address}
              wallet={{
                address,
                name: `Wallet ${index}`,
                networks: 1,
                tokens: 0,
              }}
              expanded={address === selectedAddress}
            />
          ))}
        </div>
      )}
    </div>
  );
};
