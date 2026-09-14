const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BotBounties Smart Contract", function () {
  let BotBounties;
  let botBounties;
  let owner;
  let creator;
  let hunter;
  let otherAccount;

  const ONE_BOT = ethers.parseEther("1.0");
  const FIVE_BOT = ethers.parseEther("5.0");

  beforeEach(async function () {
    [owner, creator, hunter, otherAccount] = await ethers.getSigners();
    BotBounties = await ethers.getContractFactory("BotBounties");
    botBounties = await BotBounties.deploy();
    await botBounties.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should start with 0 bounties", async function () {
      expect(await botBounties.getBountyCount()).to.equal(0);
    });
  });

  describe("createBounty", function () {
    it("should create a bounty and lock native BOT in escrow", async function () {
      const title = "Build BOT Chain Staking Interface";
      const description = "Implement React UI for staking pool";

      const tx = await botBounties.connect(creator).createBounty(title, description, {
        value: ONE_BOT,
      });

      await expect(tx)
        .to.emit(botBounties, "BountyCreated")
        .withArgs(1, creator.address, ONE_BOT, title);

      expect(await botBounties.getBountyCount()).to.equal(1);

      const bounty = await botBounties.getBounty(1);
      expect(bounty.id).to.equal(1);
      expect(bounty.creator).to.equal(creator.address);
      expect(bounty.hunter).to.equal(ethers.ZeroAddress);
      expect(bounty.rewardAmount).to.equal(ONE_BOT);
      expect(bounty.title).to.equal(title);
      expect(bounty.description).to.equal(description);
      expect(bounty.status).to.equal(0); // POSTED

      // Verify contract balance holds escrow
      const contractBalance = await ethers.provider.getBalance(await botBounties.getAddress());
      expect(contractBalance).to.equal(ONE_BOT);
    });

    it("should revert if deposit is 0", async function () {
      await expect(
        botBounties.connect(creator).createBounty("Title", "Desc", { value: 0 })
      ).to.be.revertedWithCustomError(botBounties, "ZeroDeposit");
    });

    it("should revert if title is empty", async function () {
      await expect(
        botBounties.connect(creator).createBounty("", "Desc", { value: ONE_BOT })
      ).to.be.revertedWithCustomError(botBounties, "EmptyTitle");
    });
  });

  describe("submitWork", function () {
    beforeEach(async function () {
      await botBounties.connect(creator).createBounty("Title", "Desc", { value: ONE_BOT });
    });

    it("should allow a developer to submit proof of work URL", async function () {
      const submissionUrl = "https://github.com/bot-chain/repo/pull/42";

      const tx = await botBounties.connect(hunter).submitWork(1, submissionUrl);

      await expect(tx)
        .to.emit(botBounties, "WorkSubmitted")
        .withArgs(1, hunter.address, submissionUrl);

      const bounty = await botBounties.getBounty(1);
      expect(bounty.hunter).to.equal(hunter.address);
      expect(bounty.submissionUrl).to.equal(submissionUrl);
      expect(bounty.status).to.equal(1); // SUBMITTED
      expect(bounty.submittedAt).to.be.gt(0);
    });

    it("should reject submission by the bounty creator", async function () {
      await expect(
        botBounties.connect(creator).submitWork(1, "https://github.com/pr")
      ).to.be.revertedWithCustomError(botBounties, "CreatorCannotSubmit");
    });

    it("should reject empty submission URL", async function () {
      await expect(
        botBounties.connect(hunter).submitWork(1, "")
      ).to.be.revertedWithCustomError(botBounties, "EmptySubmissionUrl");
    });

    it("should reject submission on non-existent bounty", async function () {
      await expect(
        botBounties.connect(hunter).submitWork(999, "https://github.com/pr")
      ).to.be.revertedWithCustomError(botBounties, "BountyNotFound");
    });
  });

  describe("approveAndPay", function () {
    beforeEach(async function () {
      await botBounties.connect(creator).createBounty("Title", "Desc", { value: FIVE_BOT });
      await botBounties.connect(hunter).submitWork(1, "https://github.com/repo/pull/1");
    });

    it("should allow creator to approve and release native BOT escrow to hunter", async function () {
      const hunterBalanceBefore = await ethers.provider.getBalance(hunter.address);

      const tx = await botBounties.connect(creator).approveAndPay(1);

      await expect(tx)
        .to.emit(botBounties, "BountyApproved")
        .withArgs(1, creator.address, hunter.address, FIVE_BOT);

      await expect(tx)
        .to.emit(botBounties, "BountyPaid")
        .withArgs(1, hunter.address, FIVE_BOT);

      const hunterBalanceAfter = await ethers.provider.getBalance(hunter.address);
      expect(hunterBalanceAfter - hunterBalanceBefore).to.equal(FIVE_BOT);

      const bounty = await botBounties.getBounty(1);
      expect(bounty.status).to.equal(3); // PAID
      expect(bounty.paidAt).to.be.gt(0);

      const contractBalance = await ethers.provider.getBalance(await botBounties.getAddress());
      expect(contractBalance).to.equal(0);
    });

    it("should reject approval by non-creator", async function () {
      await expect(
        botBounties.connect(otherAccount).approveAndPay(1)
      ).to.be.revertedWithCustomError(botBounties, "NotBountyCreator");
    });

    it("should reject approval if bounty is not in SUBMITTED status", async function () {
      // Create fresh bounty without submission (POSTED status)
      await botBounties.connect(creator).createBounty("Title 2", "Desc 2", { value: ONE_BOT });
      await expect(
        botBounties.connect(creator).approveAndPay(2)
      ).to.be.revertedWithCustomError(botBounties, "InvalidBountyStatus");
    });
  });

  describe("cancelBounty", function () {
    beforeEach(async function () {
      await botBounties.connect(creator).createBounty("Cancelable Bounty", "Desc", {
        value: ONE_BOT,
      });
    });

    it("should allow creator to cancel an open bounty and refund escrow", async function () {
      const balanceBefore = await ethers.provider.getBalance(creator.address);

      const tx = await botBounties.connect(creator).cancelBounty(1);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      await expect(tx)
        .to.emit(botBounties, "BountyCancelled")
        .withArgs(1, creator.address, ONE_BOT);

      const balanceAfter = await ethers.provider.getBalance(creator.address);
      expect(balanceAfter).to.equal(balanceBefore + ONE_BOT - gasUsed);

      const bounty = await botBounties.getBounty(1);
      expect(bounty.status).to.equal(4); // CANCELLED

      const contractBalance = await ethers.provider.getBalance(await botBounties.getAddress());
      expect(contractBalance).to.equal(0);
    });

    it("should reject cancellation by non-creator", async function () {
      await expect(
        botBounties.connect(otherAccount).cancelBounty(1)
      ).to.be.revertedWithCustomError(botBounties, "NotBountyCreator");
    });

    it("should reject cancellation once work has been submitted", async function () {
      await botBounties.connect(hunter).submitWork(1, "https://pr.url");
      await expect(
        botBounties.connect(creator).cancelBounty(1)
      ).to.be.revertedWithCustomError(botBounties, "InvalidBountyStatus");
    });
  });

  describe("Pagination and Batch Read", function () {
    it("should return batch bounties properly", async function () {
      for (let i = 1; i <= 3; i++) {
        await botBounties.connect(creator).createBounty(`Bounty ${i}`, `Desc ${i}`, {
          value: ONE_BOT,
        });
      }

      const list = await botBounties.getBounties(1, 2);
      expect(list.length).to.equal(2);
      expect(list[0].title).to.equal("Bounty 1");
      expect(list[1].title).to.equal("Bounty 2");

      const remaining = await botBounties.getBounties(3, 2);
      expect(remaining.length).to.equal(1);
      expect(remaining[0].title).to.equal("Bounty 3");
    });
  });
});
