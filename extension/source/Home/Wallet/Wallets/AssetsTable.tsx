import * as React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
} from '@tanstack/react-table';
import {
  CurrencyEth,
  ShareNetwork,
  StopCircle,
  CaretLeft,
  CaretRight,
} from 'phosphor-react';

import type { TokenData } from './WalletDetail';
import onAction from '../../../helpers/onAction';
import CurrencyDisplay from '../../../components/CurrencyDisplay';
import PreferredCurrencySymbol from '../../../components/PreferredCurrencySymbol';

const totalChainValue = 0.937; // ETH

export const TableHeader: React.FunctionComponent = () => (
  <div className="flex justify-between p-6">
    <div className="flex gap-4">
      <div className="flex gap-2 items-center">
        <ShareNetwork className="text-blue-500 icon-md" />
        <div className="">
          <span className="text-blue-500">Network :</span> Mainnet
        </div>
      </div>
      <div className="flex gap-2 items-center">
        <StopCircle className="text-blue-500 icon-md" />
        <div className=""> 3 Tokens</div>
      </div>
    </div>
    <div className="flex gap-4 text-[13pt]">
      <div className="flex gap-2 items-center">
        <CurrencyEth className="text-blue-500 icon-md" />
        <div className="">{totalChainValue} ETH</div>
      </div>
      <div className="flex gap-2 items-center">
        <PreferredCurrencySymbol className="text-blue-500 icon-md" />
        <div className="">
          <CurrencyDisplay chainValue={totalChainValue} />
        </div>
      </div>
    </div>
  </div>
);

interface IAssetsTable {
  data: TokenData[];
}

export const AssetsTable: React.FunctionComponent<IAssetsTable> = ({
  data,
}) => {
  const columns = React.useMemo<ColumnDef<TokenData>[]>(
    () => [
      {
        header: 'Token',
        accessorKey: 'token',
      },
      {
        header: 'Token Value',
        accessorKey: 'tokenVal',
      },
      {
        header: 'USD Value',
        accessorKey: 'usdVal',
      },
      {
        header: 'Last Transaction',
        accessorKey: 'lastTx',
      },
      {
        header: '',
        accessorKey: 'action',
      },
    ],
    [],
  );

  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 5 } },
  });

  return (
    <div className="mt-4 border border-grey-300 rounded-lg border-separate">
      <TableHeader />

      <table className="w-full">
        <thead className="text-blue-500">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th className="pb-2" key={header.id} colSpan={header.colSpan}>
                  {header.isPlaceholder ? null : (
                    <div>
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="text-center">
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="border-y border-grey-400 last:border-b-0"
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="py-3">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div
        className={[
          'bg-grey-100',
          'px-4',
          'py-2',
          'border-t',
          'border-grey-300',
          'flex',
          'justify-end',
          'gap-8',
        ].join(' ')}
      >
        <div className="flex">
          <div>showing</div>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => {
              table.setPageSize(Number(e.target.value));
            }}
            className="text-blue-500"
          >
            {[5, 10, 20, 50].map((size) => (
              <option key={size} value={size}>
                {size} results
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4">
          <CaretLeft
            {...onAction(() => table.previousPage())}
            className="cursor-pointer icon-md"
          />
          <div className="font-semibold">
            {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount()}
          </div>
          <CaretRight
            {...onAction(() => table.nextPage())}
            className="cursor-pointer icon-md"
          />
        </div>
      </div>
    </div>
  );
};
