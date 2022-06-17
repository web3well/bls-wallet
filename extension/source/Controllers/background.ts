import { runtime, tabs } from 'webextension-polyfill';

import QuillController from './QuillController';
import extensionLocalCellCollection from '../cells/extensionLocalCellCollection';
import { defaultCurrencyControllerConfig } from './CurrencyController';

// initialization flow
initialize().catch(console.error);

/**
 * Initializes the Quill controller, and sets up all platform configuration.
 */
async function initialize(): Promise<void> {
  setupController();
  console.log('Quill initialization complete.');
}

/**
 * Initializes the Quill Controller with any initial state and default language.
 * Configures platform-specific error reporting strategy.
 * Streams emitted state updates to platform-specific storage strategy.
 * Creates platform listeners for new Dapps/Contexts, and sets up their data connections to the controller.
 */
function setupController(): void {
  const quillController = new QuillController(
    extensionLocalCellCollection,
    defaultCurrencyControllerConfig,
  );

  runtime.onMessage.addListener((message, _sender) =>
    quillController.handleMessage(message),
  );

  // TODO: The old system that has been deleted had signs of useful ideas that
  // are not implemented in the new system.
  //
  // They mostly weren't implemented in the old system either, more like stubs
  // that were suggestive of what we should finish implementing. However, those
  // stubs assumed the old system, so it's not appropriate to keep them.
  //
  // Instead, here's a curated list of those ideas and references to the history
  // so anyone can easily still find them in the future.
  //
  // Close associated popups when page is closed
  // https://github.com/web3well/bls-wallet/blob/e671e73/extension/source/Controllers/background.ts#L210
  //
  // TODO: onConnectExternal / support for comms with other extensions
  // https://github.com/web3well/bls-wallet/blob/main/extension/source/Controllers/background.ts#L270
}

// On first install, open a new tab with Quill
runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    tabs.create({ url: runtime.getURL('quillPage.html#/wallet') });
  }
});
