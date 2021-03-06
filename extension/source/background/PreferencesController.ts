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

/**
 * Controller that stores shared settings and exposes convenience methods
 */
export default class PreferencesController {
  identities: ICell<Preferences['identities']>;
  preferredCurrency: IReadableCell<string | undefined>;

  constructor(public preferences: ICell<Preferences>) {
    this.identities = TransformCell.Sub(preferences, 'identities');

    this.preferredCurrency = new FormulaCell(
      { preferences },
      // eslint-disable-next-line @typescript-eslint/no-shadow
      ({ $preferences }) => {
        const { selectedAddress, identities } = $preferences;

        if (selectedAddress === undefined) {
          return undefined;
        }

        const identity = identities[selectedAddress];
        assert(identity !== undefined);

        return identity.preferredCurrency;
      },
    );
  }

  rpc = ensureType<PartialRpcImpl>()({
    setSelectedAddress: async ({ params: [selectedAddress] }) => {
      this.preferences.update({ selectedAddress });
    },
  });

  AddressPreferences(address: string): ICell<AddressPreferences | undefined> {
    return TransformCell.Sub(this.identities, address);
  }

  SelectedPreferences(): ICell<AddressPreferences> {
    const selectedAddressPromise = this.preferences.read().then((s) => {
      assert(s.selectedAddress !== undefined);
      return s.selectedAddress;
    });

    return new TransformCell(
      this.identities,
      async ($identities) => {
        const selectedAddress = await selectedAddressPromise;
        const prefs = $identities[selectedAddress];
        assert(prefs !== undefined);
        return prefs;
      },
      async ($identities, newPrefs) => {
        const selectedAddress = await selectedAddressPromise;
        return { ...$identities, [selectedAddress]: newPrefs };
      },
    );
  }

  /**
   * creates a new user and stores his details
   * @param address - address of the user
   *
   */
  async createUser(address: string, preferredCurrency: string, theme: Theme) {
    const newUserPreferences = this.AddressPreferences(address);

    assert(
      (await newUserPreferences.read()) === undefined,
      () => new Error('User already exists'),
    );

    const $preferences = await this.preferences.read();

    const selectedAddressPreferences =
      $preferences.selectedAddress &&
      $preferences.identities[$preferences.selectedAddress];

    await newUserPreferences.write({
      ...defaultAddressPreferences,
      ...selectedAddressPreferences,
      theme,
      defaultPublicAddress: address,
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
