import deepEqual from 'fast-deep-equal';

import assert from '../helpers/assert';
import ICell, { IReadableCell } from '../cells/ICell';
import TransformCell from '../cells/TransformCell';
import { FormulaCell } from '../cells/FormulaCell';
import ensureType from '../helpers/ensureType';
import {
  AddressPreferences,
  Contact,
  defaultAddressPreferences,
  Preferences,
  Theme,
} from './Preferences';
import { PartialRpcImpl } from '../types/Rpc';
import KeyringController from './KeyringController';

/**
 * Controller that stores shared settings and exposes convenience methods
 */
export default class PreferencesController {
  identities: ICell<Preferences['identities']>;
  preferredCurrency: IReadableCell<string | undefined>;

  constructor(
    public preferences: ICell<Preferences>,
    public keyringController: KeyringController,
  ) {
    this.identities = TransformCell.Sub(preferences, 'identities');

    this.preferredCurrency = new FormulaCell(
      { preferences },
      // eslint-disable-next-line @typescript-eslint/no-shadow
      ({ $preferences }) => {
        const { selectedPublicKeyHash, identities } = $preferences;

        if (selectedPublicKeyHash === undefined) {
          return undefined;
        }

        const identity = identities[selectedPublicKeyHash];
        assert(identity !== undefined);

        return identity.preferredCurrency;
      },
    );
  }

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

  AddressPreferences(
    publicKeyHash: string,
  ): ICell<AddressPreferences | undefined> {
    return TransformCell.Sub(this.identities, publicKeyHash);
  }

  SelectedPreferences(): ICell<AddressPreferences> {
    const selectedPublicKeyHashPromise = this.preferences.read().then((s) => {
      assert(s.selectedPublicKeyHash !== undefined);
      return s.selectedPublicKeyHash;
    });

    return new TransformCell(
      this.identities,
      async ($identities) => {
        const selectedPublicKeyHash = await selectedPublicKeyHashPromise;
        const prefs = $identities[selectedPublicKeyHash];
        assert(prefs !== undefined);
        return prefs;
      },
      async ($identities, newPrefs) => {
        const selectedPublicKeyHash = await selectedPublicKeyHashPromise;
        return { ...$identities, [selectedPublicKeyHash]: newPrefs };
      },
    );
  }

  /**
   * creates a new user and stores his details
   * @param address - address of the user
   *
   */
  async createUser(
    publicKeyHash: string,
    preferredCurrency: string,
    theme: Theme,
  ) {
    const newUserPreferences = this.AddressPreferences(publicKeyHash);

    assert(
      (await newUserPreferences.read()) === undefined,
      () => new Error('User already exists'),
    );

    const $preferences = await this.preferences.read();

    const selectedAddressPreferences =
      $preferences.selectedPublicKeyHash &&
      $preferences.identities[$preferences.selectedPublicKeyHash];

    await newUserPreferences.write({
      ...defaultAddressPreferences,
      ...selectedAddressPreferences,
      theme,
      defaultPublicKeyHash: publicKeyHash,
      preferredCurrency,
    });
  }

  async addContact(contact: Contact) {
    const selectedPreferences = this.SelectedPreferences();
    const $selectedPreferences = await selectedPreferences.read();

    assert(
      !$selectedPreferences.contacts.some((c) => deepEqual(c, contact)),
      () => new Error('Contact already exists'),
    );

    await selectedPreferences.update({
      contacts: [...$selectedPreferences.contacts, contact],
    });
  }

  async deleteContact(contact: Contact) {
    const selectedPreferences = this.SelectedPreferences();
    const { contacts } = await selectedPreferences.read();

    const newContacts = contacts.filter((c) => !deepEqual(c, contact));

    assert(
      newContacts.length < contacts.length,
      () => new Error("Contact doesn't exist"),
    );

    await selectedPreferences.update({
      contacts: newContacts,
    });
  }
}
