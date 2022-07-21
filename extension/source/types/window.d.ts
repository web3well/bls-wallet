import type { providers } from 'ethers';
import type { Browser } from 'webextension-polyfill';
import {
  AggregatorUtilities,
  BlsWalletWrapper,
  MockERC20,
  VerificationGateway,
} from 'bls-wallet-clients';
import type QuillEthereumProvider from '../QuillEthereumProvider';
import type { QuillContextValue } from '../QuillContext';
import QuillStorageCells from '../QuillStorageCells';

declare global {
  export interface Window {
    ethereum?: QuillEthereumProvider | providers.ExternalProvider;
    debug?: {
      Browser?: Browser;
      quill?: QuillContextValue;
      storageCells?: QuillStorageCells;
      reset?: () => unknown;
      BlsWalletWrapper?: typeof BlsWalletWrapper;
      contracts?: {
        verificationGateway: VerificationGateway;
        testToken: MockERC20;
        aggregatorUtilities: AggregatorUtilities;
      };
      wallets?: BlsWalletWrapper[];
    };
  }
}
