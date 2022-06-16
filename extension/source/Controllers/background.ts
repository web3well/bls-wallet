/**
 * @file The entry point for the web extension singleton process.
 */

import endOfStream from 'end-of-stream';
import { runtime, Runtime, Tabs, tabs } from 'webextension-polyfill';

import QuillController from './QuillController';
import { ENVIRONMENT_TYPE } from './constants';
import PortDuplexStream from '../common/PortStream';
import extensionLocalCellCollection from '../cells/extensionLocalCellCollection';
import { defaultCurrencyControllerConfig } from './CurrencyController';
import assert from '../helpers/assert';

let popupIsOpen = false;
let notificationIsOpen = false;
let uiIsTriggering = false;
const openQuillTabsIDs: Record<number, boolean> = {};
const requestAccountTabIds: Record<string, number> = {};

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
  //
  // Quill Controller
  //
  console.log('setupController');

  const quillController = new QuillController(
    extensionLocalCellCollection,
    defaultCurrencyControllerConfig,
  );

  runtime.onMessage.addListener((message, _sender) => {
    const maybePromise = quillController.handlePrivateMessage(message);

    if (maybePromise === undefined) {
      return;
    }

    return (async () => {
      try {
        return { ok: await maybePromise };
      } catch (error) {
        console.error(error);
        assert(error instanceof Error);
        return { error: { message: error.message, stack: error.stack } };
      }
    })();
  });

  runtime.onMessage.addListener((message, _sender) => {
    const maybePromise = quillController.handlePublicMessage(message);

    if (maybePromise === undefined) {
      return;
    }

    return (async () => {
      try {
        return { ok: await maybePromise };
      } catch (error) {
        console.error(error);
        assert(error instanceof Error);
        return { error: { message: error.message, stack: error.stack } };
      }
    })();
  });

  //
  // connect to other contexts
  //
  runtime.onConnect.addListener(connectRemote);
  runtime.onConnectExternal.addListener(connectExternal);

  const quillInternalProcessHash: Record<string, boolean> = {
    [ENVIRONMENT_TYPE.POPUP]: true,
    [ENVIRONMENT_TYPE.NOTIFICATION]: true,
    [ENVIRONMENT_TYPE.FULLSCREEN]: true,
  };

  const isClientOpenStatus = () => {
    return (
      popupIsOpen ||
      Boolean(Object.keys(openQuillTabsIDs).length) ||
      notificationIsOpen
    );
  };

  const onCloseEnvironmentInstances = (
    isClientOpen: boolean,
    environmentType: string,
  ) => {
    // if all instances of quill are closed we call a method on the controller to stop gasFeeController polling
    if (isClientOpen === false) {
      // TODO: handle this on controller after adding tx controller
      // controller.onClientClosed();
      // otherwise we want to only remove the polling tokens for the environment type that has closed
    } else {
      // in the case of fullscreen environment a user might have multiple tabs open so we don't want to disconnect all of
      // its corresponding polling tokens unless all tabs are closed.
      if (
        environmentType === ENVIRONMENT_TYPE.FULLSCREEN &&
        Boolean(Object.keys(openQuillTabsIDs).length)
      ) {
        return;
      }
      // TODO: handle this on controller after adding tx controller
      console.log('do something');
      // controller.onEnvironmentTypeClosed(environmentType);
    }
  };

  /**
   * Connects a Port to the Quill controller via a multiplexed duplex stream.
   * This method identifies trusted (Quill) interfaces, and connects them differently from untrusted (web pages).
   *
   * @param {Port} remotePort - The port provided by a new context.
   */
  function connectRemote(remotePort: Runtime.Port) {
    const processName = remotePort.name;
    const isQuillInternalProcess = quillInternalProcessHash[processName];

    if (isQuillInternalProcess) {
      const portStream = new PortDuplexStream(remotePort);
      // communication with popup
      quillController.isClientOpen = true;

      if (processName === ENVIRONMENT_TYPE.POPUP) {
        popupIsOpen = true;
        endOfStream(portStream, () => {
          popupIsOpen = false;
          const isClientOpen = isClientOpenStatus();
          quillController.isClientOpen = isClientOpen;
          onCloseEnvironmentInstances(isClientOpen, ENVIRONMENT_TYPE.POPUP);
        });
      }

      if (processName === ENVIRONMENT_TYPE.NOTIFICATION) {
        notificationIsOpen = true;

        endOfStream(portStream, () => {
          notificationIsOpen = false;
          const isClientOpen = isClientOpenStatus();
          quillController.isClientOpen = isClientOpen;
          onCloseEnvironmentInstances(
            isClientOpen,
            ENVIRONMENT_TYPE.NOTIFICATION,
          );
        });
      }

      if (processName === ENVIRONMENT_TYPE.FULLSCREEN) {
        const tabId = remotePort.sender?.tab?.id;
        if (!tabId) return;
        openQuillTabsIDs[tabId] = true;

        endOfStream(portStream, () => {
          delete openQuillTabsIDs[tabId];
          const isClientOpen = isClientOpenStatus();
          quillController.isClientOpen = isClientOpen;
          onCloseEnvironmentInstances(
            isClientOpen,
            ENVIRONMENT_TYPE.FULLSCREEN,
          );
        });
      }
    } else {
      if (remotePort.sender && remotePort.sender.tab && remotePort.sender.url) {
        const tabId = remotePort.sender.tab.id;
        const url = new URL(remotePort.sender.url);
        const { origin } = url;
        console.log('logging request 1', requestAccountTabIds);

        if (!tabId) return;
        remotePort.onMessage.addListener((msg) => {
          console.log('logging request 2', requestAccountTabIds);

          if (msg.data && msg.data.method === 'eth_requestAccounts') {
            requestAccountTabIds[origin] = tabId;
            console.log('logging request 3', requestAccountTabIds);
          }
        });
      }
      connectExternal(remotePort);
    }
  }

  // communication with page or other extension
  function connectExternal(remotePort: Runtime.Port) {
    const portStream = new PortDuplexStream(remotePort);
    quillController.setupUnTrustedCommunication(portStream, remotePort.sender);
  }
}

/**
 * Opens the browser popup for user confirmation
 */
async function triggerUi() {
  const activeTabs = await tabs.query({ active: true });
  const currentlyActiveQuillTab = Boolean(
    activeTabs.find((tab: Tabs.Tab) => tab.id && openQuillTabsIDs[tab.id]),
  );
  // Vivaldi is not closing port connection on popup close, so popupIsOpen does not work correctly
  // To be reviewed in the future if this behaviour is fixed - also the way we determine isVivaldi variable might change at some point
  const isVivaldi =
    activeTabs.length > 0 &&
    (activeTabs[0] as any).extData?.indexOf('vivaldi_tab') > -1;
  if (
    !uiIsTriggering &&
    (isVivaldi || !popupIsOpen) &&
    !currentlyActiveQuillTab
  ) {
    uiIsTriggering = true;
    try {
      // await notificationManager.showPopup();
    } finally {
      uiIsTriggering = false;
    }
  }
}

/**
 * Opens the browser popup for user confirmation of watchAsset
 * then it waits until user interact with the UI
 */
async function openPopup() {
  await triggerUi();
  await new Promise<void>((resolve) => {
    const interval = setInterval(() => {
      if (!notificationIsOpen) {
        clearInterval(interval);
        resolve();
      }
    }, 1000);
  });
}

// TODO: remove this later
if (process.env.NODE_ENV === 'random') openPopup();

// On first install, open a new tab with Quill
runtime.onInstalled.addListener(({ reason }) => {
  if (
    reason === 'install' &&
    !(process.env.QUILL_DEBUG || process.env.IN_TEST)
  ) {
    openExtensionInBrowser();
  }
});

function openExtensionInBrowser(route = null, queryString = null) {
  let extensionURL = runtime.getURL('quillPage.html#/wallet');

  if (route) {
    extensionURL += `#${route}`;
  }

  if (queryString) {
    extensionURL += `?${queryString}`;
  }

  tabs.create({ url: extensionURL });
}
