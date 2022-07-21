import deepEqual from 'fast-deep-equal';

import assert from '../helpers/assert';
import ICell from '../cells/ICell';
import ensureType from '../helpers/ensureType';
import { Contact, Preferences } from './Preferences';
import { PartialRpcImpl } from '../types/Rpc';
import KeyringController from './KeyringController';

/**
 * Controller that stores shared settings and exposes convenience methods
 *
 * TODO: PreferencesController isn't doing much. Consider moving this logic
 *       somewhere else.
 */
export default class PreferencesController {
  constructor(
    public preferences: ICell<Preferences>,
    public keyringController: KeyringController,
  ) {}

  rpc = ensureType<PartialRpcImpl>()({
    setSelectedAddress: async ({ params: [selectedAddress] }) => {
      const walletsNetworkData =
        await this.keyringController.getWalletsNetworkData();

      for (const [publicKeyHash, walletNetworkData] of Object.entries(
        walletsNetworkData,
      )) {
        assert(walletNetworkData !== undefined);

        if (walletNetworkData.address === selectedAddress) {
          await this.preferences.update({
            selectedPublicKeyHash: publicKeyHash,
          });

          return;
        }
      }

      assert(false, () => new Error("Couldn't find matching wallet"));
    },
  });

  async addContact(contact: Contact) {
    const $preferences = await this.preferences.read();

    assert(
      !$preferences.contacts.some((c) => deepEqual(c, contact)),
      () => new Error('Contact already exists'),
    );

    await this.preferences.update({
      contacts: [...$preferences.contacts, contact],
    });
  }

  async deleteContact(contact: Contact) {
    const { contacts } = await this.preferences.read();

    const newContacts = contacts.filter((c) => !deepEqual(c, contact));

    assert(
      newContacts.length < contacts.length,
      () => new Error("Contact doesn't exist"),
    );

    await this.preferences.update({
      contacts: newContacts,
    });
  }
}
