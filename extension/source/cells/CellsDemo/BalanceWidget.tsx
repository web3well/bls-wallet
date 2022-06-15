import { ethers } from 'ethers';
import { FunctionComponent, useMemo } from 'react';
import { FormulaCell } from '../FormulaCell';
import MemoryCell from '../MemoryCell';
import { useQuill } from '../../QuillPage/QuillContext';
import { Display } from './Display';
import TextBox from './TextBox';

const BalanceWidget: FunctionComponent = () => {
  const quillCtx = useQuill();

  const cells = useMemo(() => {
    const address = new MemoryCell('');

    const balanceDisplay = new FormulaCell(
      { address, _: quillCtx.blockNumber },
      async ({ $address }) => {
        const addressError = (() => {
          try {
            // Handles mixed case checksums
            ethers.utils.getAddress($address);
            return undefined;
          } catch (err) {
            const error = err as Error;

            if (error.message.includes('bad address checksum')) {
              return new Error('bad address checksum');
            }

            return error;
          }
        })();

        if (addressError) {
          return `(${addressError.message})`;
        }

        const balance = await quillCtx.ethersProvider.getBalance($address);
        return `ETH: ${(+ethers.utils.formatEther(balance)).toFixed(3)}`;
      },
    );

    return { address, balanceDisplay };
  }, [quillCtx]);

  return (
    <>
      <tr>
        <td>Address:</td>
        <td>
          <TextBox value={cells.address} />
        </td>
      </tr>
      <tr>
        <td>Balance:</td>
        <td>
          <Display cell={cells.balanceDisplay} />
        </td>
      </tr>
    </>
  );
};

export default BalanceWidget;
