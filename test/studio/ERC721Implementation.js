const { expect } = require('chai');
const { ethers } = require('hardhat');
const { getMerkleProof } = require('../helpers/merkleTree');

describe('ERC721Implementation', function() {
  let myCollection;
  let tokenPrice, tokenMaxSupply;
  let whitelistMintLimit, publicMintLimit;

  beforeEach(async function() {
    [
      owner,
      ,
      whitelisted1,
      whitelisted2,
      whitelisted3,
      notWhitelisted,
    ] = await ethers.getSigners();

    const ERC721Implementation = await ethers.getContractFactory(
      'ERC721Implementation',
    );
    myCollection = await ERC721Implementation.deploy();
    await myCollection.deployed();

    // Initialize
    await myCollection.initialize(
      'Blank Studio Collection',
      'BSC',
      '0xcd03b1680c151ca091ff2660b40d4c36d9248c782c7eac1643157917cbf89dec',
    );

    // Configure contract for test
    await myCollection.setMintLimits(4000, 5, 1);
    await myCollection.setRoyalties(
      '0xE5F135b20F496189FB6C915bABc53e0A70Ff6A1f',
      1000,
    );
    await myCollection.setTokenPrice('80000000000000000'); // 0.08 ETH
    await myCollection.setBaseURI(
      'ipfs://QmSBxebqcuP8GyUxaFVEDqpsmbcjNMxg5y3i1UAHLkhHg5/',
    );
    await myCollection.toggleWhitelistOnly();

    // Read config and denormalize props
    ({
      tokenPrice,
      tokenMaxSupply,
      whitelistMintLimit,
      publicMintLimit,
    } = await myCollection.saleConfig());
  });

  describe('Mint', function() {
    it('should not mint if minting is disabled', async function() {
      await expect(
        myCollection
          .connect(whitelisted1)
          .mint(1, getMerkleProof(whitelisted1.address), {
            value: tokenPrice,
          }),
      ).to.be.revertedWithCustomError(myCollection, 'MintingDisabled');
    });

    it('should not mint if not enough ETH is provided', async function() {
      await myCollection.toggleMinting();

      await expect(
        myCollection
          .connect(whitelisted1)
          .mint(1, getMerkleProof(whitelisted1.address), {
            value: tokenPrice.sub(1),
          }),
      ).to.be.revertedWithCustomError(myCollection, 'InvalidValueProvided');
    });

    it('should not mint if there are no tokens left', async function() {
      await myCollection.toggleMinting();

      const wantedNumberOfTokens = tokenMaxSupply.add(1);

      await expect(
        myCollection
          .connect(whitelisted1)
          .mint(wantedNumberOfTokens, getMerkleProof(whitelisted1.address), {
            value: tokenPrice.mul(wantedNumberOfTokens),
          }),
      ).to.be.revertedWithCustomError(myCollection, 'NoMoreTokensLeft');
    });
  });

  describe('Whitelist mint phase', function() {
    beforeEach(async function() {
      await myCollection.toggleMinting();
    });

    it('should mint if caller is whitelisted', async function() {
      expect(await myCollection.balanceOf(whitelisted1.address)).to.equal(0);
      expect(await myCollection.amountMinted(whitelisted1.address)).to.equal(0);

      await myCollection
        .connect(whitelisted1)
        .mint(1, getMerkleProof(whitelisted1.address), { value: tokenPrice });

      expect(await myCollection.balanceOf(whitelisted1.address)).to.equal(1);
      expect(await myCollection.amountMinted(whitelisted1.address)).to.equal(1);
    });

    it('should not allow whitelisted caller to mint more than whitelist mint limit', async function() {
      const wantedNumberOfTokens = whitelistMintLimit.add(1);

      await expect(
        myCollection
          .connect(whitelisted1)
          .mint(wantedNumberOfTokens, getMerkleProof(whitelisted1.address), {
            value: tokenPrice.mul(wantedNumberOfTokens),
          }),
      ).to.be.revertedWithCustomError(myCollection, 'MintLimitReached');
    });

    it('should not mint if caller is not whitelisted', async function() {
      await expect(
        myCollection
          .connect(notWhitelisted)
          .mint(1, getMerkleProof(notWhitelisted.address), {
            value: tokenPrice,
          }),
      ).to.be.revertedWithCustomError(myCollection, 'NotWhitelisted');
    });

    it('should not mint if not whitelisted caller uses proof of another whitelisted address', async function() {
      await expect(
        myCollection
          .connect(notWhitelisted)
          .mint(1, getMerkleProof(whitelisted1.address), {
            value: tokenPrice,
          }),
      ).to.be.revertedWithCustomError(myCollection, 'NotWhitelisted');
    });

    it('should not mint if whitelisted caller uses proof of another whitelisted address', async function() {
      await expect(
        myCollection
          .connect(whitelisted1)
          .mint(1, getMerkleProof(whitelisted2.address), {
            value: tokenPrice,
          }),
      ).to.be.revertedWithCustomError(myCollection, 'NotWhitelisted');
    });
  });

  describe('Public mint phase', function() {
    beforeEach(async function() {
      await myCollection.toggleMinting();
      // Allow public mint phase
      await myCollection.toggleWhitelistOnly();
    });

    it('should mint if caller is any user', async function() {
      await myCollection.connect(notWhitelisted).mint(publicMintLimit, [], {
        value: tokenPrice.mul(publicMintLimit),
      });
    });

    it('should not allow user to mint more than public mint limit', async function() {
      const wantedNumberOfTokens = publicMintLimit.add(1);

      await expect(
        myCollection.connect(notWhitelisted).mint(wantedNumberOfTokens, [], {
          value: tokenPrice.mul(wantedNumberOfTokens),
        }),
      ).to.be.revertedWithCustomError(myCollection, 'MintLimitReached');
    });

    it('should mint after airdrop', async function() {
      expect(await myCollection.balanceOf(notWhitelisted.address)).to.equal(0);

      await myCollection.airdrop([notWhitelisted.address], [1]);

      await myCollection.connect(notWhitelisted).mint(publicMintLimit, [], {
        value: tokenPrice.mul(publicMintLimit),
      });

      expect(await myCollection.balanceOf(notWhitelisted.address)).to.equal(
        publicMintLimit.add(1),
      );
    });
  });

  describe('Interface support', function() {
    it('supports ERC165 interface', async function() {
      expect(await myCollection.supportsInterface('0x01ffc9a7')).to.equal(true);
    });

    it('supports ERC721 interface', async function() {
      expect(await myCollection.supportsInterface('0x80ac58cd')).to.equal(true);
    });

    it('supports ERC721Metadata interface', async function() {
      expect(await myCollection.supportsInterface('0x5b5e139f')).to.equal(true);
    });

    it('supports ERC2981 interface', async function() {
      expect(await myCollection.supportsInterface('0x2a55205a')).to.equal(true);
    });
  });

  describe('Only owner functions', function() {
    describe('Config functions', function() {
      it('should toggle minting', async function() {
        expect((await myCollection.saleConfig()).mintActive).to.equal(false);

        await myCollection.toggleMinting();

        expect((await myCollection.saleConfig()).mintActive).to.equal(true);
      });

      it('should toggle whitelist mint', async function() {
        expect((await myCollection.saleConfig()).whitelistMintActive).to.equal(
          true,
        );

        await myCollection.toggleWhitelistOnly();

        expect((await myCollection.saleConfig()).whitelistMintActive).to.equal(
          false,
        );
      });

      it('should not allow to toggle minting if caller is not owner', async function() {
        await expect(
          myCollection.connect(whitelisted1).toggleMinting(),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('should not allow to toggle whitelist mint if caller is not owner', async function() {
        await expect(
          myCollection.connect(whitelisted1).toggleWhitelistOnly(),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('should toggle operator filterer', async function() {
        expect(await myCollection.isOperatorFiltererEnabled()).to.equal(false);

        await myCollection.toggleOperatorFilterer();

        expect(await myCollection.isOperatorFiltererEnabled()).to.equal(true);
      });

      it('should not allow to toggle operator filterer if caller is not owner', async function() {
        await expect(
          myCollection.connect(whitelisted1).toggleOperatorFilterer(),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('should set token price', async function() {
        const { tokenPrice } = await myCollection.saleConfig();
        expect(tokenPrice.toString()).to.equal('80000000000000000');

        await myCollection.setTokenPrice('10000000000000000');

        const {
          tokenPrice: updatedTokenPrice,
        } = await myCollection.saleConfig();
        expect(updatedTokenPrice.toString()).to.equal('10000000000000000');
      });

      it('should not allow to set token price if caller is not owner', async function() {
        await expect(
          myCollection.connect(whitelisted1).setTokenPrice('10000000000000000'),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('should set mint limits', async function() {
        await myCollection.setMintLimits(1337, 12, 19);

        const {
          tokenMaxSupply,
          publicMintLimit,
          whitelistMintLimit,
        } = await myCollection.saleConfig();

        expect(tokenMaxSupply).to.equal(1337);
        expect(publicMintLimit).to.equal(12);
        expect(whitelistMintLimit).to.equal(19);
      });

      it('should not allow to set mint limits if caller is not owner', async function() {
        await expect(
          myCollection.connect(whitelisted1).setMintLimits(1337, 12, 19),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });
    });

    describe('Airdrop tokens', function() {
      it('should airdrop tokens correctly', async function() {
        const to = [whitelisted3.address, notWhitelisted.address];
        const quantity = [3, 4];

        await myCollection.airdrop(to, quantity);

        expect(await myCollection.balanceOf(to[0])).to.equal(3);
        expect(await myCollection.balanceOf(to[1])).to.equal(4);
      });

      it('should not allow to airdrop more tokens than token max supply', async function() {
        const to = [
          whitelisted3.address,
          notWhitelisted.address,
          whitelisted2.address,
        ];
        const quantity = [4, tokenMaxSupply.sub(2), 3];

        await expect(
          myCollection.airdrop(to, quantity),
        ).to.be.revertedWithCustomError(myCollection, 'NoMoreTokensLeft');
      });

      it('should not allow to airdrop if caller is not owner', async function() {
        const to = [whitelisted3.address, notWhitelisted.address];
        const quantity = [3, 4];

        await expect(
          myCollection.connect(whitelisted1).airdrop(to, quantity),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });
    });

    describe('Base URI', function() {
      it('should set base URI correctly', async function() {
        await myCollection.airdrop([whitelisted1.address], [1]);

        expect(await myCollection.tokenURI(1)).to.equal(
          'ipfs://QmSBxebqcuP8GyUxaFVEDqpsmbcjNMxg5y3i1UAHLkhHg5/1',
        );

        await myCollection.setBaseURI(
          'ipfs://QmbJxj9yTDhDHXYQUHjyz74GxP1VCwF3pkVWCvBTejF3kD/',
        );

        expect(await myCollection.tokenURI(1)).to.equal(
          'ipfs://QmbJxj9yTDhDHXYQUHjyz74GxP1VCwF3pkVWCvBTejF3kD/1',
        );
      });

      it('should not allow to set base URI if caller is not owner', async function() {
        await expect(
          myCollection
            .connect(whitelisted1)
            .setBaseURI(
              'ipfs://QmbJxj9yTDhDHXYQUHjyz74GxP1VCwF3pkVWCvBTejF3kD/',
            ),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });
    });

    describe('Set royalties', function() {
      it('should set royalties correctly', async function() {
        await myCollection.setRoyalties(whitelisted1.address, 4000);

        const [royaltyReceiver, royaltyAmount] = await myCollection.royaltyInfo(
          0,
          1000,
        );

        expect(royaltyReceiver).to.equal(whitelisted1.address);
        expect(royaltyAmount).to.equal(1000 * 0.4);
      });

      it('should not allow to set royalties if caller is not owner', async function() {
        await expect(
          myCollection
            .connect(whitelisted1)
            .setRoyalties(whitelisted2.address, 2000),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });
    });

    describe('Withdraw funds', function() {
      it('should withdraw funds to the owner', async function() {
        await myCollection.toggleMinting();
        await myCollection.toggleWhitelistOnly();
        await myCollection
          .connect(whitelisted1)
          .mint(1, getMerkleProof(whitelisted1.address), {
            value: tokenPrice.mul(1),
          });

        const balanceBefore = await ethers.provider.getBalance(owner.address);

        const withdrawTX = await myCollection.withdrawAllFunds();
        const { gasUsed, effectiveGasPrice } = await withdrawTX.wait();

        const balanceAfter = await ethers.provider.getBalance(owner.address);
        const totalGasUsedForWithdrawal = gasUsed.mul(effectiveGasPrice);

        expect(balanceAfter.sub(balanceBefore)).to.equal(
          tokenPrice.mul(1).sub(totalGasUsedForWithdrawal),
        );
      });

      it('should not allow to withdraw funds if caller is not owner', async function() {
        await expect(
          myCollection.connect(whitelisted1).withdrawAllFunds(),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });
    });
  });
});
