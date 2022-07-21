import { ethers } from 'ethers';
import { ArrowRight } from 'phosphor-react';
import { FunctionComponent, useMemo } from 'react';
import Blockies from 'react-blockies';
import TextBox from '../../../../cells/components/TextBox';

import ICell from '../../../../cells/ICell';
import MemoryCell from '../../../../cells/MemoryCell';
import useCell from '../../../../cells/useCell';
import Loading from '../../../../components/Loading';
import onAction from '../../../../helpers/onAction';
import { useQuill } from '../../../../QuillContext';
import Balance from '../Balance';

const RecipientSelector: FunctionComponent<{
  recipient: ICell<string | undefined>;
}> = ({ recipient }) => {
  const quill = useQuill();
  const selectedAddress = useCell(quill.cells.selectedAddress);
  const ethAccounts = useCell(quill.cells.ethAccounts) ?? [];

  const searchText = useMemo(() => new MemoryCell(''), []);
  const searchTextValue = useCell(searchText);

  const searchTextLowercase = (searchTextValue ?? '').toLowerCase();

  const recipients = (() => {
    if (searchTextValue && ethers.utils.isAddress(searchTextValue)) {
      return [{ address: searchTextValue, name: 'Custom Recipient' }];
    }

    return ethAccounts
      .map((address, i) => ({
        address,
        name: `Wallet ${i}`,
      }))
      .filter((r) => r.address !== selectedAddress)
      .filter(
        (r) =>
          r.address.toLowerCase().includes(searchTextLowercase) ||
          r.name.toLowerCase().includes(searchTextLowercase),
      );
  })();

  return (
    <div className="flex flex-col gap-4">
      <div className="text-body">Select Recipient</div>
      <div>
        <TextBox value={searchText} placeholder="Search" />
      </div>
      {recipients.length === 0 && 'No recipients found'}
      <div className="grid grid-cols-2 gap-4">
        {recipients.map((r) => {
          if (r === undefined) {
            return <div />;
          }

          return (
            <div
              key={`${r.name}:${r.address}`}
              className={[
                'flex',
                'flex-row',
                'p-4',
                'gap-4',
                'rounded-lg',
                'bg-white',
                'border',
                'border-grey-400',
                'shadow-md',
                'cursor-pointer',
                'active:bg-grey-200',
                'select-none',
                'cursor-pointer',
              ].join(' ')}
              {...onAction(() => recipient.write(r.address))}
            >
              <Blockies
                seed={r.address}
                className="rounded-md self-center"
                size={5}
                scale={8}
              />
              <div className="grow self-center">{r.name}</div>
              <div className="self-center">
                {selectedAddress && <Balance address={r.address} />}
                {!selectedAddress && <Loading />}
              </div>
              <ArrowRight className="self-center" size={20} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecipientSelector;
