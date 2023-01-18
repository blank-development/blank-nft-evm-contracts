const { expect } = require("chai");
const { ethers } = require("hardhat");
const { getMerkleProof } = require("./helpers/merkleTree");

describe("MyCollection", function() {
  let myCollection;
  let tokenPrice, tokenMaxSupply;
  let whitelistMintLimit, publicMintLimit;
  let royaltyRecipient;

  beforeEach(async function() {
    [
      owner,
      ,
      whitelisted1,
      whitelisted2,
      whitelisted3,
      notWhitelisted,
      crossmintEOA,
    ] = await ethers.getSigners();

    const MyCollection = await ethers.getContractFactory("MyCollection");
    myCollection = await MyCollection.deploy(
      "ipfs://QmSBxebqcuP8GyUxaFVEDqpsmbcjNMxg5y3i1UAHLkhHg5/",
      "0xcd03b1680c151ca091ff2660b40d4c36d9248c782c7eac1643157917cbf89dec",
      "0xE5F135b20F496189FB6C915bABc53e0A70Ff6A1f",
      1000,
      crossmintEOA.address
    );
    await myCollection.deployed();

    tokenPrice = await myCollection.TOKEN_PRICE();
    tokenMaxSupply = await myCollection.TOKEN_MAX_SUPPLY();
    whitelistMintLimit = await myCollection.WHITELIST_MINT_LIMIT();
    publicMintLimit = await myCollection.PUBLIC_MINT_LIMIT();

    royaltyRecipient = await myCollection.royaltyRecipient();
  });

  describe("Mint general", function() {
    describe("Main mint function", function() {
      it("should not mint if minting is disabled", async function() {
        await expect(
          myCollection
            .connect(whitelisted1)
            .mint(1, getMerkleProof(whitelisted1.address), {
              value: tokenPrice,
            })
        ).to.be.revertedWithCustomError(myCollection, "MintingDisabled");
      });

      it("should not mint if not enough ETH is provided", async function() {
        await myCollection.toggleMinting();

        await expect(
          myCollection
            .connect(whitelisted1)
            .mint(1, getMerkleProof(whitelisted1.address), {
              value: tokenPrice.sub(1),
            })
        ).to.be.revertedWithCustomError(myCollection, "InvalidValueProvided");
      });

      it("should not mint if there are no tokens left", async function() {
        await myCollection.toggleMinting();

        const wantedNumberOfTokens = tokenMaxSupply.add(1);

        await expect(
          myCollection
            .connect(whitelisted1)
            .mint(wantedNumberOfTokens, getMerkleProof(whitelisted1.address), {
              value: tokenPrice.mul(wantedNumberOfTokens),
            })
        ).to.be.revertedWithCustomError(myCollection, "NoMoreTokensLeft");
      });
    });

    describe("Crossmint", function() {
      it("should not mint if minting is disabled", async function() {
        await expect(
          myCollection
            .connect(crossmintEOA)
            .crossmint(
              whitelisted1.address,
              1,
              getMerkleProof(whitelisted1.address),
              {
                value: tokenPrice,
              }
            )
        ).to.be.revertedWithCustomError(myCollection, "MintingDisabled");
      });

      it("should not mint if not enough ETH is provided", async function() {
        await myCollection.toggleMinting();

        await expect(
          myCollection
            .connect(crossmintEOA)
            .crossmint(
              whitelisted1.address,
              1,
              getMerkleProof(whitelisted1.address),
              {
                value: tokenPrice.sub(1),
              }
            )
        ).to.be.revertedWithCustomError(myCollection, "InvalidValueProvided");
      });

      it("should not mint if there are no tokens left", async function() {
        await myCollection.toggleMinting();

        const wantedNumberOfTokens = tokenMaxSupply.add(1);

        await expect(
          myCollection
            .connect(crossmintEOA)
            .crossmint(
              whitelisted1.address,
              wantedNumberOfTokens,
              getMerkleProof(whitelisted1.address),
              {
                value: tokenPrice.mul(wantedNumberOfTokens),
              }
            )
        ).to.be.revertedWithCustomError(myCollection, "NoMoreTokensLeft");
      });

      it("should mint if caller is Crossmint wallet", async function() {
        await myCollection.toggleMinting();

        expect(await myCollection.balanceOf(whitelisted1.address)).to.equal(0);

        await myCollection
          .connect(crossmintEOA)
          .crossmint(
            whitelisted1.address,
            1,
            getMerkleProof(whitelisted1.address),
            {
              value: tokenPrice,
            }
          );

        expect(await myCollection.balanceOf(whitelisted1.address)).to.equal(1);
      });

      it("should not mint if caller is not Crossmint EOA", async function() {
        await myCollection.toggleMinting();

        await expect(
          myCollection
            .connect(whitelisted1)
            .crossmint(
              whitelisted1.address,
              1,
              getMerkleProof(whitelisted1.address),
              {
                value: tokenPrice,
              }
            )
        ).to.be.revertedWithCustomError(myCollection, "InvalidCaller");
      });
    });
  });

  describe("Whitelist mint phase", function() {
    beforeEach(async function() {
      await myCollection.toggleMinting();
    });

    describe("Main mint function", function() {
      it("should mint if caller is whitelisted", async function() {
        expect(await myCollection.balanceOf(whitelisted1.address)).to.equal(0);
        expect(await myCollection.amountMinted(whitelisted1.address)).to.equal(
          0
        );

        await myCollection
          .connect(whitelisted1)
          .mint(1, getMerkleProof(whitelisted1.address), { value: tokenPrice });

        expect(await myCollection.balanceOf(whitelisted1.address)).to.equal(1);
        expect(await myCollection.amountMinted(whitelisted1.address)).to.equal(
          1
        );
      });

      it("should not allow whitelisted caller to mint more than whitelist mint limit", async function() {
        const wantedNumberOfTokens = whitelistMintLimit.add(1);

        await expect(
          myCollection
            .connect(whitelisted1)
            .mint(wantedNumberOfTokens, getMerkleProof(whitelisted1.address), {
              value: tokenPrice.mul(wantedNumberOfTokens),
            })
        ).to.be.revertedWithCustomError(myCollection, "MintLimitReached");
      });

      it("should not mint if caller is not whitelisted", async function() {
        await expect(
          myCollection
            .connect(notWhitelisted)
            .mint(1, getMerkleProof(notWhitelisted.address), {
              value: tokenPrice,
            })
        ).to.be.revertedWithCustomError(myCollection, "NotWhitelisted");
      });

      it("should not mint if not whitelisted caller uses proof of another whitelisted address", async function() {
        await expect(
          myCollection
            .connect(notWhitelisted)
            .mint(1, getMerkleProof(whitelisted1.address), {
              value: tokenPrice,
            })
        ).to.be.revertedWithCustomError(myCollection, "NotWhitelisted");
      });

      it("should not mint if whitelisted caller uses proof of another whitelisted address", async function() {
        await expect(
          myCollection
            .connect(whitelisted1)
            .mint(1, getMerkleProof(whitelisted2.address), {
              value: tokenPrice,
            })
        ).to.be.revertedWithCustomError(myCollection, "NotWhitelisted");
      });

      it("should not allow to mint more than whitelist mint limit after using crossmint function", async function() {
        const wantedNumberOfTokens = whitelistMintLimit;

        await myCollection
          .connect(crossmintEOA)
          .crossmint(
            whitelisted1.address,
            wantedNumberOfTokens,
            getMerkleProof(whitelisted1.address),
            {
              value: tokenPrice.mul(wantedNumberOfTokens),
            }
          );

        await expect(
          myCollection
            .connect(whitelisted1)
            .mint(1, getMerkleProof(whitelisted1.address), {
              value: tokenPrice,
            })
        ).to.be.revertedWithCustomError(myCollection, "MintLimitReached");
      });
    });

    describe("Crossmint", function() {
      it("should mint if recipient is whitelisted", async function() {
        expect(await myCollection.balanceOf(whitelisted1.address)).to.equal(0);

        await myCollection
          .connect(crossmintEOA)
          .crossmint(
            whitelisted1.address,
            1,
            getMerkleProof(whitelisted1.address),
            {
              value: tokenPrice,
            }
          );

        expect(await myCollection.balanceOf(whitelisted1.address)).to.equal(1);
      });

      it("should not allow to mint more than whitelist mint limit to whitelisted recipient", async function() {
        const wantedNumberOfTokens = whitelistMintLimit.add(1);

        await expect(
          myCollection
            .connect(crossmintEOA)
            .crossmint(
              whitelisted1.address,
              wantedNumberOfTokens,
              getMerkleProof(whitelisted1.address),
              {
                value: tokenPrice.mul(wantedNumberOfTokens),
              }
            )
        ).to.be.revertedWithCustomError(myCollection, "MintLimitReached");
      });

      it("should not mint if recipient is not whitelisted", async function() {
        await expect(
          myCollection
            .connect(crossmintEOA)
            .crossmint(
              notWhitelisted.address,
              1,
              getMerkleProof(notWhitelisted.address),
              {
                value: tokenPrice,
              }
            )
        ).to.be.revertedWithCustomError(myCollection, "NotWhitelisted");
      });

      it("should not mint if not whitelisted recipient uses proof of another whitelisted address", async function() {
        await expect(
          myCollection
            .connect(crossmintEOA)
            .crossmint(
              notWhitelisted.address,
              1,
              getMerkleProof(whitelisted1.address),
              {
                value: tokenPrice,
              }
            )
        ).to.be.revertedWithCustomError(myCollection, "NotWhitelisted");
      });

      it("should not mint if whitelisted recipient uses proof of another whitelisted address", async function() {
        await expect(
          myCollection
            .connect(crossmintEOA)
            .crossmint(
              whitelisted1.address,
              1,
              getMerkleProof(whitelisted2.address),
              { value: tokenPrice }
            )
        ).to.be.revertedWithCustomError(myCollection, "NotWhitelisted");
      });

      it("should not allow to mint more than whitelist mint limit after using main mint function", async function() {
        const wantedNumberOfTokens = whitelistMintLimit;

        await myCollection
          .connect(whitelisted1)
          .mint(wantedNumberOfTokens, getMerkleProof(whitelisted1.address), {
            value: tokenPrice.mul(wantedNumberOfTokens),
          });

        await expect(
          myCollection
            .connect(crossmintEOA)
            .crossmint(
              whitelisted1.address,
              1,
              getMerkleProof(whitelisted1.address),
              {
                value: tokenPrice,
              }
            )
        ).to.be.revertedWithCustomError(myCollection, "MintLimitReached");
      });
    });
  });

  describe("Public mint phase", function() {
    beforeEach(async function() {
      await myCollection.toggleMinting();

      await myCollection.toggleWhitelistOnly();
    });

    describe("Main mint function", function() {
      it("should mint if caller is any user", async function() {
        const wantedNumberOfTokens = publicMintLimit;

        await myCollection
          .connect(notWhitelisted)
          .mint(wantedNumberOfTokens, [], {
            value: tokenPrice.mul(wantedNumberOfTokens),
          });
      });

      it("should not allow user to mint more than public mint limit", async function() {
        const wantedNumberOfTokens = publicMintLimit.add(1);

        await expect(
          myCollection.connect(notWhitelisted).mint(wantedNumberOfTokens, [], {
            value: tokenPrice.mul(wantedNumberOfTokens),
          })
        ).to.be.revertedWithCustomError(myCollection, "MintLimitReached");
      });

      it("should mint after airdrop", async function() {
        expect(await myCollection.balanceOf(notWhitelisted.address)).to.equal(
          0
        );

        await myCollection.airdrop([notWhitelisted.address], [1]);

        const wantedNumberOfTokens = publicMintLimit;

        await myCollection
          .connect(notWhitelisted)
          .mint(wantedNumberOfTokens, [], {
            value: tokenPrice.mul(wantedNumberOfTokens),
          });

        expect(await myCollection.balanceOf(notWhitelisted.address)).to.equal(
          publicMintLimit.add(1)
        );
      });

      it("should not allow to mint more than public mint limit after using crossmint function", async function() {
        const wantedNumberOfTokens = publicMintLimit;

        await myCollection
          .connect(crossmintEOA)
          .crossmint(notWhitelisted.address, wantedNumberOfTokens, [], {
            value: tokenPrice.mul(wantedNumberOfTokens),
          });

        await expect(
          myCollection.connect(notWhitelisted).mint(1, [], {
            value: tokenPrice,
          })
        ).to.be.revertedWithCustomError(myCollection, "MintLimitReached");
      });
    });

    describe("Crossmint", function() {
      it("should mint if recipient is any user", async function() {
        const wantedNumberOfTokens = publicMintLimit;

        await myCollection
          .connect(crossmintEOA)
          .crossmint(notWhitelisted.address, wantedNumberOfTokens, [], {
            value: tokenPrice.mul(wantedNumberOfTokens),
          });
      });

      it("should not allow to mint more than public mint limit to recipient", async function() {
        const wantedNumberOfTokens = publicMintLimit.add(1);

        await expect(
          myCollection
            .connect(crossmintEOA)
            .crossmint(notWhitelisted.address, wantedNumberOfTokens, [], {
              value: tokenPrice.mul(wantedNumberOfTokens),
            })
        ).to.be.revertedWithCustomError(myCollection, "MintLimitReached");
      });

      it("should mint after airdrop", async function() {
        expect(await myCollection.balanceOf(notWhitelisted.address)).to.equal(
          0
        );

        await myCollection.airdrop([notWhitelisted.address], [1]);

        const wantedNumberOfTokens = publicMintLimit;

        await myCollection
          .connect(crossmintEOA)
          .crossmint(notWhitelisted.address, wantedNumberOfTokens, [], {
            value: tokenPrice.mul(wantedNumberOfTokens),
          });

        expect(await myCollection.balanceOf(notWhitelisted.address)).to.equal(
          publicMintLimit.add(1)
        );
      });

      it("should not allow to mint more than public mint limit after using main mint function", async function() {
        const wantedNumberOfTokens = publicMintLimit;

        await myCollection
          .connect(notWhitelisted)
          .mint(wantedNumberOfTokens, [], {
            value: tokenPrice.mul(wantedNumberOfTokens),
          });

        await expect(
          myCollection
            .connect(crossmintEOA)
            .crossmint(notWhitelisted.address, 1, [], {
              value: tokenPrice,
            })
        ).to.be.revertedWithCustomError(myCollection, "MintLimitReached");
      });
    });
  });

  describe("Interface support", function() {
    it("supports ERC165 interface", async function() {
      expect(await myCollection.supportsInterface("0x01ffc9a7")).to.equal(true);
    });

    it("supports ERC721 interface", async function() {
      expect(await myCollection.supportsInterface("0x80ac58cd")).to.equal(true);
    });

    it("supports ERC721Metadata interface", async function() {
      expect(await myCollection.supportsInterface("0x5b5e139f")).to.equal(true);
    });

    it("supports ERC2981 interface", async function() {
      expect(await myCollection.supportsInterface("0x2a55205a")).to.equal(true);
    });
  });

  describe("Only owner functions", function() {
    describe("Toggle functions", function() {
      it("should toggle minting", async function() {
        expect(await myCollection.mintActive()).to.equal(false);

        await myCollection.toggleMinting();

        expect(await myCollection.mintActive()).to.equal(true);
      });

      it("should toggle whitelist mint", async function() {
        expect(await myCollection.whitelistMintActive()).to.equal(true);

        await myCollection.toggleWhitelistOnly();

        expect(await myCollection.whitelistMintActive()).to.equal(false);
      });

      it("should not allow to toggle minting if caller is not owner", async function() {
        await expect(
          myCollection.connect(whitelisted1).toggleMinting()
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should not allow to toggle whitelist mint if caller is not owner", async function() {
        await expect(
          myCollection.connect(whitelisted1).toggleWhitelistOnly()
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("Airdrop tokens", function() {
      it("should airdrop tokens correctly", async function() {
        const to = [whitelisted3.address, notWhitelisted.address];
        const quantity = [3, 4];

        await myCollection.airdrop(to, quantity);

        expect(await myCollection.balanceOf(to[0])).to.equal(3);
        expect(await myCollection.balanceOf(to[1])).to.equal(4);
      });

      it("should not allow to airdrop more tokens than token max supply", async function() {
        const to = [
          whitelisted3.address,
          notWhitelisted.address,
          whitelisted2.address,
        ];
        const quantity = [4, tokenMaxSupply.sub(2), 3];

        await expect(
          myCollection.airdrop(to, quantity)
        ).to.be.revertedWithCustomError(myCollection, "NoMoreTokensLeft");
      });

      it("should not allow to airdrop if caller is not owner", async function() {
        const to = [whitelisted3.address, notWhitelisted.address];
        const quantity = [3, 4];

        await expect(
          myCollection.connect(whitelisted1).airdrop(to, quantity)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("Reveal art", function() {
      it("should reveal correctly if contract is not sealed", async function() {
        await myCollection.airdrop([whitelisted1.address], [1]);

        expect(await myCollection.tokenURI(1)).to.equal(
          "ipfs://QmSBxebqcuP8GyUxaFVEDqpsmbcjNMxg5y3i1UAHLkhHg5/1"
        );

        await myCollection.reveal(
          "ipfs://QmbJxj9yTDhDHXYQUHjyz74GxP1VCwF3pkVWCvBTejF3kD/"
        );

        expect(await myCollection.tokenURI(1)).to.equal(
          "ipfs://QmbJxj9yTDhDHXYQUHjyz74GxP1VCwF3pkVWCvBTejF3kD/1"
        );
      });

      it("should not allow to reveal if contract is already sealed", async function() {
        await myCollection.sealContractPermanently();

        await expect(
          myCollection.reveal(
            "ipfs://QmbJxj9yTDhDHXYQUHjyz74GxP1VCwF3pkVWCvBTejF3kD/"
          )
        ).to.be.revertedWithCustomError(myCollection, "ContractSealed");
      });

      it("should not allow to reveal art if caller is not owner", async function() {
        await expect(
          myCollection
            .connect(whitelisted1)
            .reveal("ipfs://QmbJxj9yTDhDHXYQUHjyz74GxP1VCwF3pkVWCvBTejF3kD/")
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("Seal contract", function() {
      it("should seal contract", async function() {
        expect(await myCollection.contractSealed()).to.equal(false);

        await myCollection.sealContractPermanently();

        expect(await myCollection.contractSealed()).to.equal(true);
      });

      it("should not allow to seal contract if contract is already sealed", async function() {
        await myCollection.sealContractPermanently();

        await expect(
          myCollection.sealContractPermanently()
        ).to.be.revertedWithCustomError(myCollection, "ContractSealed");
      });

      it("should not allow to seal contract if caller is not owner", async function() {
        await expect(
          myCollection.connect(whitelisted1).sealContractPermanently()
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("Set Crossmint wallet", function() {
      it("should set crossmint address correctly", async function() {
        await myCollection.setCrossmintWallet(notWhitelisted.address);

        expect(await myCollection.crossmintWallet()).to.equal(
          notWhitelisted.address
        );
      });

      it("should not allow to set crossmint address if caller is not owner", async function() {
        await expect(
          myCollection
            .connect(whitelisted1)
            .setCrossmintWallet(notWhitelisted.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("Set royalties", function() {
      it("should set royalties correctly", async function() {
        await myCollection.setDefaultRoyalty(whitelisted1.address, 4000);

        const [royaltyReceiver, royaltyAmount] = await myCollection.royaltyInfo(
          0,
          1000
        );

        expect(royaltyReceiver).to.equal(whitelisted1.address);
        expect(royaltyAmount).to.equal(1000 * 0.4);
      });

      it("should not allow to set royalties if caller is not owner", async function() {
        await expect(
          myCollection
            .connect(whitelisted1)
            .setDefaultRoyalty(whitelisted2.address, 2000)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("Withdraw funds", function() {
      it("should withdraw funds to royalty recipient", async function() {
        await myCollection.toggleMinting();
        await myCollection.toggleWhitelistOnly();
        await myCollection
          .connect(whitelisted1)
          .mint(1, getMerkleProof(whitelisted1.address), {
            value: tokenPrice.mul(1),
          });

        const balanceBefore = await ethers.provider.getBalance(
          royaltyRecipient
        );

        await myCollection.withdrawAllFunds();

        const balanceAfter = await ethers.provider.getBalance(royaltyRecipient);
        expect(balanceAfter.sub(balanceBefore)).to.equal(tokenPrice.mul(1));
      });

      it("should not allow to withdraw funds if caller is not owner", async function() {
        await expect(
          myCollection.connect(whitelisted1).withdrawAllFunds()
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });
});
