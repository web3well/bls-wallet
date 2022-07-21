import { runtime, tabs } from 'webextension-polyfill';

import QuillController from './QuillController';
import extensionLocalCellCollection from '../cells/extensionLocalCellCollection';
import { RpcRequest, toRpcResult } from '../types/Rpc';
import toOkError from '../helpers/toOkError';
import { castType } from '../cells/assertType';
import forEach from '../cells/forEach';
import Debug from './Debug';
import { FormulaCell } from '../cells/FormulaCell';
import { assertConfig } from '../helpers/assert';
import { loadBlsNetworksConfig } from '../BlsNetworksConfig';
import { loadConfig } from '../Config';

(() => {
  console.log('Quill background script started');

  const quillController = new QuillController(
    loadConfig(),
    loadBlsNetworksConfig(),
    extensionLocalCellCollection,
    // TODO: Pass in config rather than accessing it globally
  );

  setupOnboardingTrigger(quillController);
  setupRequests(quillController);
  setupPorts(quillController);
  setupDebugging(quillController);
})();

function setupOnboardingTrigger(quillController: QuillController) {
  // On install, open a new tab with Quill
  quillController.cells.onboarding.read().then(async (onboarding) => {
    if (!onboarding.autoOpened) {
      await quillController.cells.onboarding.update({ autoOpened: true });
      tabs.create({ url: runtime.getURL('home.html') });
    }
  });
}

function setupRequests(quillController: QuillController) {
  let shouldLog = true;

  forEach(quillController.cells.developerSettings, (developerSettings) => {
    shouldLog = developerSettings.rpcLogging.background;
  });

  runtime.onMessage.addListener((request, _sender) => {
    const response = quillController.handleRequest(request);

    if (response === undefined) {
      return undefined;
    }

    // Just casting here because `handleRequest` does the rtti checking.
    castType(request, RpcRequest);

    if (shouldLog) {
      const host =
        request.origin === window.location.origin
          ? '<quill>'
          : new URL(request.origin).host;

      console.log(
        `${host}:${request.providerId.slice(0, 5)}:`,
        `${request.method}(${request.params
          .map((p) => JSON.stringify(p))
          .join(', ')}) ->`,
        response,
      );
    }

    return toOkError(() => response).then(toRpcResult);
  });
}

function setupPorts(_quillController: QuillController) {
  runtime.onConnect.addListener((port) => {
    if (!port.name.startsWith('quill-provider-')) {
      return;
    }

    console.log('Connected:', port.name);

    port.onDisconnect.addListener(() => {
      // TODO: Provide disconnect information to QuillController so that eg
      // `LongPollingCell`s can stop iteration (reducing derived network
      // requests).
      console.log('Disconnected:', port.name, port.error);
    });
  });
}

function setupDebugging(quillController: QuillController) {
  forEach(
    FormulaCell.Sub(
      quillController.cells.developerSettings,
      'breakOnAssertionFailures',
    ),
    ($breakOnAssertionFailures) => {
      assertConfig.breakOnFailures = $breakOnAssertionFailures;
    },
  );

  window.debug = Debug(quillController);
}

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
// onConnectExternal / support for comms with other extensions
// https://github.com/web3well/bls-wallet/blob/main/extension/source/Controllers/background.ts#L270
//
// Getting metadata about networks:
// https://github.com/web3well/bls-wallet/blob/d2b18f3/extension/source/Controllers/Network/NetworkController.ts#L110-L171
