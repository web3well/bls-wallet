import "@nomiclabs/hardhat-ethers";
import { ethers, network } from "hardhat";
import {
  Signer,
  Contract,
  ContractFactory,
  BigNumber,
  BigNumberish,
  providers,
} from "ethers";

import {
  BlsWalletWrapper,
  BlsWalletSigner,
  initBlsWalletSigner,
  Bundle,
} from "../../clients/src";

import Range from "./Range";
import assert from "./assert";
import Create2Fixture from "./Create2Fixture";
import { VerificationGateway, BLSOpen } from "../../typechain";

export default class Fixture {
  static readonly ECDSA_ACCOUNTS_LENGTH = 5;
  static readonly DEFAULT_BLS_ACCOUNTS_LENGTH = 5;

  private constructor(
    public chainId: number,
    public provider: providers.Provider,

    public signers: Signer[],
    public addresses: string[],

    public lazyBlsWallets: (() => Promise<BlsWalletWrapper>)[],

    public verificationGateway: VerificationGateway,

    public blsLibrary: BLSOpen,
    public blsExpander: Contract,
    public utilities: Contract,

    public BLSWallet: ContractFactory,
    public blsWalletSigner: BlsWalletSigner,
  ) {}

  /// @dev Contracts deployed by first ethers signer
  static async create(
    blsWalletCount: number = Fixture.DEFAULT_BLS_ACCOUNTS_LENGTH,
    secretNumbers?: number[],
  ) {
    const chainId = (await ethers.provider.getNetwork()).chainId;

    const allSigners = await ethers.getSigners();
    const signers = allSigners.slice(0, Fixture.ECDSA_ACCOUNTS_LENGTH);
    const addresses = (await Promise.all(
      signers.map((acc) => acc.getAddress()),
    )) as string[];

    // const create2Fixture = Create2Fixture.create();

    // deploy wallet implementation contract
    const blsWalletFactory = await ethers.getContractFactory("BLSWallet");
    const blsWalletImpl = await (await blsWalletFactory.deploy()).deployed();
    try {
      await (
        await blsWalletImpl.initialize(ethers.constants.AddressZero)
      ).wait();
    } catch (e) {}

    const blsFactory = await ethers.getContractFactory("BLSOpen");
    const bls = await (await blsFactory.deploy()).deployed();
    // deploy Verification Gateway
    const vgFactory = await ethers.getContractFactory("VerificationGateway");
    const verificationGateway = await (
      await vgFactory.deploy(bls.address, blsWalletImpl.address)
    ).deployed();

    const blsExpanderFactory = await ethers.getContractFactory("BLSExpander");

    // deploy BLSExpander Gateway
    const blsExpander = await (
      await blsExpanderFactory.deploy(verificationGateway.address)
    ).deployed();

    const utilitiesFactory = await ethers.getContractFactory(
      "AggregatorUtilities",
    );

    // deploy utilities
    const utilities = await (await utilitiesFactory.deploy()).deployed();

    const BLSWallet = await ethers.getContractFactory("BLSWallet");

    const lazyBlsWallets = Range(blsWalletCount).map((i) => {
      let secretNumber: number;

      if (secretNumbers !== undefined) {
        secretNumber = secretNumbers[i];
        assert(!isNaN(secretNumber), "secret ");
      } else {
        secretNumber = Math.abs((Math.random() * 0xffffffff) << 0);
      }

      return async () => {
        const wallet = await BlsWalletWrapper.connect(
          `0x${secretNumber.toString(16)}`,
          verificationGateway.address,
          verificationGateway.provider,
        );

        // Perform an empty transaction to trigger wallet creation
        await (
          await verificationGateway.processBundle(
            wallet.sign({ nonce: BigNumber.from(0), actions: [] }),
          )
        ).wait();

        return wallet;
      };
    });

    return new Fixture(
      chainId,
      ethers.provider,
      signers,
      addresses,
      lazyBlsWallets,
      verificationGateway,
      bls,
      blsExpander,
      utilities,
      BLSWallet,
      await initBlsWalletSigner({ chainId }),
    );
  }

  /**
   * Creates new BLS contract wallets from private keys
   * @returns array of wallets
   */
  async createBLSWallets(): Promise<BlsWalletWrapper[]> {
    return await Promise.all(
      this.lazyBlsWallets.map((lazyWallet) => lazyWallet()),
    );
  }

  bundleFrom(
    wallet: BlsWalletWrapper,
    contract: Contract,
    method: string,
    params: any[],
    nonce: BigNumberish,
    ethValue: BigNumberish = 0,
  ): Bundle {
    return this.blsWalletSigner.aggregate([
      wallet.sign({
        nonce: nonce,
        actions: [
          {
            ethValue: ethValue,
            contractAddress: contract.address,
            encodedFunction: contract.interface.encodeFunctionData(
              method,
              params,
            ),
          },
        ],
      }),
    ]);
  }

  async call(
    wallet: BlsWalletWrapper,
    contract: Contract,
    method: string,
    params: any[],
    nonce: BigNumberish,
    ethValue: BigNumberish = 0,
  ) {
    await (
      await this.verificationGateway.processBundle(
        this.bundleFrom(wallet, contract, method, params, nonce, ethValue),
      )
    ).wait();
  }

  async callStatic(
    wallet: BlsWalletWrapper,
    contract: Contract,
    method: string,
    params: any[],
    nonce: BigNumberish,
    ethValue: BigNumberish = 0,
  ) {
    return await this.verificationGateway.callStatic.processBundle(
      this.bundleFrom(wallet, contract, method, params, nonce, ethValue),
    );
  }

  async advanceTimeBy(seconds: number) {
    // Advance time one week
    const latestTimestamp = (await ethers.provider.getBlock("latest"))
      .timestamp;

    await network.provider.send("evm_setNextBlockTimestamp", [
      BigNumber.from(latestTimestamp).add(seconds).toHexString(),
    ]);

    const wallet = await this.lazyBlsWallets[1]();

    // Process an empty operation so that the next timestamp above actually gets
    // into a block. This enables static calls to see the updated time.
    await (
      await this.verificationGateway.processBundle(
        wallet.sign({
          nonce: await wallet.Nonce(),
          actions: [],
        }),
      )
    ).wait();
  }
}
