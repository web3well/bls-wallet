import { expect } from "chai";

import { ethers, network } from "hardhat";
import { ContractTransaction } from "ethers";

import Fixture from "../shared/helpers/Fixture";

import { parseEther } from "ethers/lib/utils";
import deployAndRunPrecompileCostEstimator from "../shared/helpers/deployAndRunPrecompileCostEstimator";
import { defaultDeployerAddress } from "../shared/helpers/deployDeployer";
import { BlsWalletWrapper, PublicKey } from "../clients/src";

describe("setExternalWallet", async function () {
  if (`${process.env.DEPLOYER_DEPLOYMENT}` === "true") {
    console.log("Skipping non-deployer tests.");
    return;
  }

  this.beforeAll(async function () {
    // deploy the deployer contract for the transient hardhat network
    if (network.name === "hardhat") {
      // fund deployer wallet address
      const fundedSigner = (await ethers.getSigners())[0];
      await (
        await fundedSigner.sendTransaction({
          to: defaultDeployerAddress(),
          value: parseEther("1"),
        })
      ).wait();

      // deploy the precompile contract (via deployer)
      console.log("PCE:", await deployAndRunPrecompileCostEstimator());
    }
  });

  let fx: Fixture;
  beforeEach(async function () {
    if (network.name === "rinkarby") {
      fx = await Fixture.create(Fixture.DEFAULT_BLS_ACCOUNTS_LENGTH);
    } else {
      fx = await Fixture.create();
    }
  });

  it("should not allow setting existing public key", async () => {
    const wallet1 = await fx.createWallet();
    const newPublicKey = (await fx.connectWallet()).PublicKey();

    // Ordinary setting a new public key
    await (await setExternalWallet(fx, wallet1, newPublicKey)).wait();

    const wallet2 = await fx.createWallet();

    // Setting another wallet to the same public key should fail
    await expect(
      setExternalWallet(fx, wallet2, newPublicKey),
    ).to.be.rejectedWith("mapping to this wallet already exists");
  });
});

async function setExternalWallet(
  fx: Fixture,
  wallet: BlsWalletWrapper,
  newPublicKey: PublicKey,
): Promise<ContractTransaction> {
  return fx.verificationGateway.processBundle(
    wallet.sign({
      nonce: await wallet.Nonce(),
      actions: [
        {
          ethValue: 0,
          contractAddress: fx.verificationGateway.address,
          encodedFunction: fx.verificationGateway.interface.encodeFunctionData(
            "setExternalWallet",
            [wallet.signMessage(wallet.address), newPublicKey],
          ),
        },
      ],
    }),
  );
}
