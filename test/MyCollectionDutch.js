const { expect } = require("chai");
const { ethers } = require("hardhat");
const helpers = require("@nomicfoundation/hardhat-network-helpers");

async function getTimestampOfLatestBlock() {
  // Returns the timestamp of the latest block
  return await helpers.time.latest();
}

describe("MyCollectionDutch", function() {
  let myCollectionDutch;

  let tokenMaxSupply, tokenMintLimit;

  let tokenPublicPrice;

  let tokenAuctionSupply,
    auctionStartTime,
    auctionStartPrice,
    auctionEndPrice,
    auctionPriceCurveLength,
    auctionDropInterval,
    auctionDropPerStep;

  let royaltyRecipient;

  beforeEach(async function() {
    [owner, user1, user2] = await ethers.getSigners();

    const currentTimestamp = await getTimestampOfLatestBlock();
    auctionStartTime = currentTimestamp + 10000;

    const MyCollectionDutch = await ethers.getContractFactory(
      "MyCollectionDutch"
    );
    myCollectionDutch = await MyCollectionDutch.deploy(
      "ipfs://QmSBxebqcuP8GyUxaFVEDqpsmbcjNMxg5y3i1UAHLkhHg5/",
      auctionStartTime
    );

    tokenMaxSupply = await myCollectionDutch.TOKEN_MAX_SUPPLY();
    tokenMintLimit = await myCollectionDutch.TOKEN_MINT_LIMIT();

    tokenPublicPrice = await myCollectionDutch.TOKEN_PUBLIC_PRICE();

    tokenAuctionSupply = await myCollectionDutch.TOKEN_AUCTION_SUPPLY();
    auctionStartPrice = await myCollectionDutch.AUCTION_START_PRICE();
    auctionEndPrice = await myCollectionDutch.AUCTION_END_PRICE();
    auctionPriceCurveLength = (
      await myCollectionDutch.AUCTION_PRICE_CURVE_LENGTH()
    ).toNumber();
    auctionDropInterval = (
      await myCollectionDutch.AUCTION_DROP_INTERVAL()
    ).toNumber();
    auctionDropPerStep = await myCollectionDutch.AUCTION_DROP_PER_STEP();

    royaltyRecipient = await myCollectionDutch.ROYALTY_RECIPIENT();
  });

  describe("Dutch auction", function() {
    describe("Auction mint", function() {
      it("should not mint if auction did not started", async function() {
        expect(await getTimestampOfLatestBlock()).to.be.lessThan(
          auctionStartTime
        );

        const currentTokenPrice = await myCollectionDutch.getCurrentPrice();

        await expect(
          myCollectionDutch
            .connect(user1)
            .auctionMint(1, { value: currentTokenPrice })
        ).to.be.revertedWithCustomError(myCollectionDutch, "AuctionNotStarted");
      });

      it("should mint if auction started and user provides correct value", async function() {
        // Mines a new block whose timestamp is auctionStartTime
        await helpers.time.increaseTo(auctionStartTime);

        const currentTokenPrice = await myCollectionDutch.getCurrentPrice();

        // auctionMint() function will be called in block that will have timestamp that is
        // higher by 1 than timestamp that is set with increaseTo(). We mined a new block
        // using increaseTo() so we can get correct price when calling getCurrentPrice().
        await myCollectionDutch
          .connect(user1)
          .auctionMint(1, { value: currentTokenPrice });
      });

      it("should not mint if auction started and user provides incorrect value", async function() {
        await helpers.time.increaseTo(auctionStartTime);

        const currentTokenPrice = await myCollectionDutch.getCurrentPrice();

        await expect(
          myCollectionDutch
            .connect(user1)
            .auctionMint(1, { value: currentTokenPrice.sub(1) })
        ).to.be.revertedWithCustomError(myCollectionDutch, "InvalidValue");
      });

      it("should not allow to mint more tokens than auction supply", async function() {
        await helpers.time.increaseTo(auctionStartTime);

        const currentTokenPrice = await myCollectionDutch.getCurrentPrice();

        const wantedNumberOfTokens = tokenAuctionSupply.add(1);

        await expect(
          myCollectionDutch.connect(user1).auctionMint(wantedNumberOfTokens, {
            value: currentTokenPrice.mul(wantedNumberOfTokens),
          })
        ).to.be.revertedWithCustomError(myCollectionDutch, "NoMoreTokensLeft");
      });

      it("should not allow user to mint more than mint limit", async function() {
        await helpers.time.increaseTo(auctionStartTime);

        const currentTokenPrice = await myCollectionDutch.getCurrentPrice();

        const wantedNumberOfTokens = tokenMintLimit.add(1);

        await expect(
          myCollectionDutch.connect(user1).auctionMint(wantedNumberOfTokens, {
            value: currentTokenPrice.mul(wantedNumberOfTokens),
          })
        ).to.be.revertedWithCustomError(myCollectionDutch, "MintLimitReached");
      });
    });

    describe("Current auction price", function() {
      it("should return start price before auction starts", async function() {
        expect(await getTimestampOfLatestBlock()).to.be.lessThan(
          auctionStartTime
        );

        const currentTokenPrice = await myCollectionDutch.getCurrentPrice();

        expect(currentTokenPrice).to.equal(auctionStartPrice);
      });

      it("should return start price at the start of auction", async function() {
        await helpers.time.increaseTo(auctionStartTime);

        const currentTokenPrice = await myCollectionDutch.getCurrentPrice();

        expect(currentTokenPrice).to.equal(auctionStartPrice);
      });

      it("should return end price at exactly end of price dropping", async function() {
        await helpers.time.increaseTo(
          auctionStartTime + auctionPriceCurveLength
        );

        const currentTokenPrice = await myCollectionDutch.getCurrentPrice();

        expect(currentTokenPrice).to.equal(auctionEndPrice);
      });

      it("should return end price after price dropping stops", async function() {
        await helpers.time.increaseTo(
          auctionStartTime + auctionPriceCurveLength + 1000
        );

        const currentTokenPrice = await myCollectionDutch.getCurrentPrice();

        expect(currentTokenPrice).to.equal(auctionEndPrice);
      });

      it("should return correct price in phase where price is dropping", async function() {
        // 1. example
        await helpers.time.increaseTo(auctionStartTime + auctionDropInterval);

        let currentTokenPrice = await myCollectionDutch.getCurrentPrice();

        expect(currentTokenPrice).to.equal(
          auctionStartPrice.sub(auctionDropPerStep)
        );

        // 2. example
        await helpers.time.increaseTo(
          auctionStartTime + 3 * auctionDropInterval
        );

        currentTokenPrice = await myCollectionDutch.getCurrentPrice();

        expect(currentTokenPrice).to.equal(
          auctionStartPrice.sub(auctionDropPerStep.mul(3))
        );
      });
    });
  });

  describe("Public mint", function() {
    beforeEach(async function() {
      await myCollectionDutch.toggleMinting();
    });

    it("should mint if user provides correct quantity and value", async function() {
      expect(await myCollectionDutch.balanceOf(user1.address)).to.equal(0);

      await myCollectionDutch
        .connect(user1)
        .publicMint(1, { value: tokenPublicPrice.mul(1) });

      expect(await myCollectionDutch.balanceOf(user1.address)).to.equal(1);
    });

    it("should not mint if minting is disabled", async function() {
      // Disable minting
      await myCollectionDutch.toggleMinting();

      await expect(
        myCollectionDutch
          .connect(user1)
          .publicMint(1, { value: tokenPublicPrice })
      ).to.be.revertedWithCustomError(myCollectionDutch, "MintingDisabled");
    });

    it("should not mint if user dont provide enough ETH", async function() {
      await expect(
        myCollectionDutch.connect(user1).publicMint(1, {
          value: tokenPublicPrice.sub(1),
        })
      ).to.be.revertedWithCustomError(myCollectionDutch, "InvalidValue");
    });

    it("should not mint if there are no tokens left", async function() {
      const wantedNumberOfTokens = tokenMaxSupply.add(1);

      await expect(
        myCollectionDutch.connect(user1).publicMint(wantedNumberOfTokens, {
          value: tokenPublicPrice.mul(wantedNumberOfTokens),
        })
      ).to.be.revertedWithCustomError(myCollectionDutch, "NoMoreTokensLeft");
    });

    it("should not allow user to mint more than mint limit", async function() {
      const wantedNumberOfTokens = tokenMintLimit.add(1);

      await expect(
        myCollectionDutch.connect(user1).publicMint(wantedNumberOfTokens, {
          value: tokenPublicPrice.mul(wantedNumberOfTokens),
        })
      ).to.be.revertedWithCustomError(myCollectionDutch, "MintLimitReached");
    });

    it("should mint after airdrop", async function() {
      expect(await myCollectionDutch.balanceOf(user1.address)).to.equal(0);

      await myCollectionDutch.airdrop([user1.address], [1]);

      const wantedNumberOfTokens = tokenMintLimit;

      await myCollectionDutch.connect(user1).publicMint(wantedNumberOfTokens, {
        value: tokenPublicPrice.mul(wantedNumberOfTokens),
      });

      expect(await myCollectionDutch.balanceOf(user1.address)).to.equal(
        tokenMintLimit.add(1)
      );
    });

    it("should mint after auction mint if user respects mint limit", async function() {
      await helpers.time.increaseTo(auctionStartTime);

      const currentTokenPrice = await myCollectionDutch.getCurrentPrice();

      await myCollectionDutch
        .connect(user1)
        .auctionMint(1, { value: currentTokenPrice });

      const wantedNumberOfTokens = tokenMintLimit.sub(1);

      await myCollectionDutch.connect(user1).publicMint(wantedNumberOfTokens, {
        value: tokenPublicPrice.mul(wantedNumberOfTokens),
      });

      expect(await myCollectionDutch.balanceOf(user1.address)).to.equal(
        tokenMintLimit
      );
    });

    it("should not mint after auction mint if user do not respect mint limit", async function() {
      await helpers.time.increaseTo(auctionStartTime);

      const currentTokenPrice = await myCollectionDutch.getCurrentPrice();

      await myCollectionDutch
        .connect(user1)
        .auctionMint(1, { value: currentTokenPrice });

      const wantedNumberOfTokens = tokenMintLimit;

      await expect(
        myCollectionDutch.connect(user1).publicMint(wantedNumberOfTokens, {
          value: tokenPublicPrice.mul(wantedNumberOfTokens),
        })
      ).to.be.revertedWithCustomError(myCollectionDutch, "MintLimitReached");
    });
  });

  describe("Interface support", function() {
    it("supports ERC165 interface", async function() {
      expect(await myCollectionDutch.supportsInterface("0x01ffc9a7")).to.equal(
        true
      );
    });

    it("supports ERC721 interface", async function() {
      expect(await myCollectionDutch.supportsInterface("0x80ac58cd")).to.equal(
        true
      );
    });

    it("supports ERC721Metadata interface", async function() {
      expect(await myCollectionDutch.supportsInterface("0x5b5e139f")).to.equal(
        true
      );
    });

    it("supports ERC2981 interface", async function() {
      expect(await myCollectionDutch.supportsInterface("0x2a55205a")).to.equal(
        true
      );
    });
  });

  describe("Only owner functions", function() {
    describe("Toggle functions", function() {
      it("should toggle public minting", async function() {
        expect(await myCollectionDutch.publicMintActive()).to.equal(false);

        await myCollectionDutch.toggleMinting();

        expect(await myCollectionDutch.publicMintActive()).to.equal(true);
      });

      it("should not allow to toggle minting if caller is not owner", async function() {
        await expect(
          myCollectionDutch.connect(user1).toggleMinting()
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("Airdrop tokens", function() {
      it("should airdrop tokens correctly", async function() {
        const to = [user1.address, user2.address];
        const quantity = [3, 4];

        await myCollectionDutch.airdrop(to, quantity);

        expect(await myCollectionDutch.balanceOf(to[0])).to.equal(3);
        expect(await myCollectionDutch.balanceOf(to[1])).to.equal(4);
      });

      it("should not allow to airdrop more tokens than token max supply", async function() {
        const to = [owner.address, user1.address, user2.address];
        const quantity = [4, tokenMaxSupply.sub(2), 3];

        await expect(
          myCollectionDutch.airdrop(to, quantity)
        ).to.be.revertedWithCustomError(myCollectionDutch, "NoMoreTokensLeft");
      });

      it("should not allow to airdrop if caller is not owner", async function() {
        const to = [user1.address, user2.address];
        const quantity = [3, 4];

        await expect(
          myCollectionDutch.connect(user1).airdrop(to, quantity)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("Reveal art", function() {
      it("should reveal correctly if contract is not sealed", async function() {
        await myCollectionDutch.airdrop([user1.address], [1]);

        expect(await myCollectionDutch.tokenURI(1)).to.equal(
          "ipfs://QmSBxebqcuP8GyUxaFVEDqpsmbcjNMxg5y3i1UAHLkhHg5/1"
        );

        await myCollectionDutch.reveal(
          "ipfs://QmbJxj9yTDhDHXYQUHjyz74GxP1VCwF3pkVWCvBTejF3kD/"
        );

        expect(await myCollectionDutch.tokenURI(1)).to.equal(
          "ipfs://QmbJxj9yTDhDHXYQUHjyz74GxP1VCwF3pkVWCvBTejF3kD/1"
        );
      });

      it("should not allow to reveal if contract is already sealed", async function() {
        await myCollectionDutch.sealContractPermanently();

        await expect(
          myCollectionDutch.reveal(
            "ipfs://QmbJxj9yTDhDHXYQUHjyz74GxP1VCwF3pkVWCvBTejF3kD/"
          )
        ).to.be.revertedWithCustomError(myCollectionDutch, "ContractSealed");
      });

      it("should not allow to reveal art if caller is not owner", async function() {
        await expect(
          myCollectionDutch
            .connect(user1)
            .reveal("ipfs://QmbJxj9yTDhDHXYQUHjyz74GxP1VCwF3pkVWCvBTejF3kD/")
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("Seal contract", function() {
      it("should seal contract", async function() {
        expect(await myCollectionDutch.contractSealed()).to.equal(false);

        await myCollectionDutch.sealContractPermanently();

        expect(await myCollectionDutch.contractSealed()).to.equal(true);
      });

      it("should not allow to seal contract if contract is already sealed", async function() {
        await myCollectionDutch.sealContractPermanently();

        await expect(
          myCollectionDutch.sealContractPermanently()
        ).to.be.revertedWithCustomError(myCollectionDutch, "ContractSealed");
      });

      it("should not allow to seal contract if caller is not owner", async function() {
        await expect(
          myCollectionDutch.connect(user1).sealContractPermanently()
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("Set royalties", function() {
      it("should set royalties correctly", async function() {
        await myCollectionDutch.setDefaultRoyalty(user1.address, 4000);

        const [
          royaltyReceiver,
          royaltyAmount,
        ] = await myCollectionDutch.royaltyInfo(0, 1000);

        expect(royaltyReceiver).to.equal(user1.address);
        expect(royaltyAmount).to.equal(1000 * 0.4);
      });

      it("should not allow to set royalties if caller is not owner", async function() {
        await expect(
          myCollectionDutch
            .connect(user1)
            .setDefaultRoyalty(user1.address, 2000)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("Withdraw funds", function() {
      it("should withdraw funds to royalty recipient", async function() {
        await myCollectionDutch.toggleMinting();
        await myCollectionDutch.connect(user1).publicMint(1, {
          value: tokenPublicPrice.mul(1),
        });

        const balanceBefore = await ethers.provider.getBalance(
          royaltyRecipient
        );

        await myCollectionDutch.withdrawAllFunds();

        const balanceAfter = await ethers.provider.getBalance(royaltyRecipient);
        expect(balanceAfter.sub(balanceBefore)).to.equal(
          tokenPublicPrice.mul(1)
        );
      });

      it("should not allow to withdraw funds if caller is not owner", async function() {
        await expect(
          myCollectionDutch.connect(user1).withdrawAllFunds()
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });
});
