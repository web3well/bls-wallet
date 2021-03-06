import type { providers } from 'ethers';
import type { Browser } from 'webextension-polyfill';
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
    };
  }
}
