const { expect } = require('chai');
const { ethers } = require('hardhat');
const { getMerkleProof } = require('./helpers/merkleTree');

describe('MyCollection', function() {
  let myCollection;
  let tokenPrice, tokenMaxSupply;
  let whitelistMintLimit, publicMintLimit;

  const whitelist = [
    '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    '0x9460A151252F2DCd2E97c3110e1Aa371E124Fa41',
    '0x65BdDece298B6108956bf8c2d0422619105B3b95',
    '0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db',
    '0x6d393B949579C9bD667CB6EE0FC06ab79088Bd95',
    '0x35F9e6afAEff89A38bd0cB5c7E6B18a54b956115',
    '0xd21277065b30f83185a5d65e50f9f0e532833cb5',
    '0x3d77a01ef9265f8af731367abf5b467641764191',
    '0xd4B399CF7B25dD140559470Cca18E6395645c0b3',
    '0x78e7C4C88d44aD2178a2Cf5cC8883a761996e2E9',
  ];

  beforeEach(async function() {
    [
      owner,
      ,
      whitelisted1,
      whitelisted2,
      whitelisted3,
      notWhitelisted,
    ] = await ethers.getSigners();

    const MyCollection = await ethers.getContractFactory('MyCollection');
    myCollection = await MyCollection.deploy(
      'ipfs://QmSBxebqcuP8GyUxaFVEDqpsmbcjNMxg5y3i1UAHLkhHg5/',
      '0xcd03b1680c151ca091ff2660b40d4c36d9248c782c7eac1643157917cbf89dec',
    );
    await myCollection.deployed();

    await myCollection.setRoyalties(
      '0xE5F135b20F496189FB6C915bABc53e0A70Ff6A1f',
      1000,
    );

    tokenPrice = await myCollection.TOKEN_PRICE();
    tokenMaxSupply = await myCollection.TOKEN_MAX_SUPPLY();
    whitelistMintLimit = await myCollection.WHITELIST_MINT_LIMIT();
    publicMintLimit = await myCollection.PUBLIC_MINT_LIMIT();
  });

  describe('Mint general', function() {
    describe('Main mint function', function() {
      it('should not mint if minting is disabled', async function() {
        await expect(
          myCollection
            .connect(whitelisted1)
            .mint(1, getMerkleProof(whitelist, whitelisted1.address), {
              value: tokenPrice,
            }),
        ).to.be.revertedWithCustomError(myCollection, 'MintingDisabled');
      });

      it('should not mint if not enough ETH is provided', async function() {
        await myCollection.toggleMinting();

        await expect(
          myCollection
            .connect(whitelisted1)
            .mint(1, getMerkleProof(whitelist, whitelisted1.address), {
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
            .mint(
              wantedNumberOfTokens,
              getMerkleProof(whitelist, whitelisted1.address),
              {
                value: tokenPrice.mul(wantedNumberOfTokens),
              },
            ),
        ).to.be.revertedWithCustomError(myCollection, 'NoMoreTokensLeft');
      });
    });
  });

  describe('Whitelist mint phase', function() {
    beforeEach(async function() {
      await myCollection.toggleMinting();
    });

    describe('Main mint function', function() {
      it('should mint if caller is whitelisted', async function() {
        expect(await myCollection.balanceOf(whitelisted1.address)).to.equal(0);
        expect(await myCollection.amountMinted(whitelisted1.address)).to.equal(
          0,
        );

        await myCollection
          .connect(whitelisted1)
          .mint(1, getMerkleProof(whitelist, whitelisted1.address), {
            value: tokenPrice,
          });

        expect(await myCollection.balanceOf(whitelisted1.address)).to.equal(1);
        expect(await myCollection.amountMinted(whitelisted1.address)).to.equal(
          1,
        );
      });

      it('should not allow whitelisted caller to mint more than whitelist mint limit', async function() {
        const wantedNumberOfTokens = whitelistMintLimit.add(1);

        await expect(
          myCollection
            .connect(whitelisted1)
            .mint(
              wantedNumberOfTokens,
              getMerkleProof(whitelist, whitelisted1.address),
              {
                value: tokenPrice.mul(wantedNumberOfTokens),
              },
            ),
        ).to.be.revertedWithCustomError(myCollection, 'MintLimitReached');
      });

      it('should not mint if caller is not whitelisted', async function() {
        await expect(
          myCollection
            .connect(notWhitelisted)
            .mint(1, getMerkleProof(whitelist, notWhitelisted.address), {
              value: tokenPrice,
            }),
        ).to.be.revertedWithCustomError(myCollection, 'NotWhitelisted');
      });

      it('should not mint if not whitelisted caller uses proof of another whitelisted address', async function() {
        await expect(
          myCollection
            .connect(notWhitelisted)
            .mint(1, getMerkleProof(whitelist, whitelisted1.address), {
              value: tokenPrice,
            }),
        ).to.be.revertedWithCustomError(myCollection, 'NotWhitelisted');
      });

      it('should not mint if whitelisted caller uses proof of another whitelisted address', async function() {
        await expect(
          myCollection
            .connect(whitelisted1)
            .mint(1, getMerkleProof(whitelist, whitelisted2.address), {
              value: tokenPrice,
            }),
        ).to.be.revertedWithCustomError(myCollection, 'NotWhitelisted');
      });
    });
  });

  describe('Public mint phase', function() {
    beforeEach(async function() {
      await myCollection.toggleMinting();

      await myCollection.toggleWhitelistOnly();
    });

    describe('Main mint function', function() {
      it('should mint if caller is any user', async function() {
        const wantedNumberOfTokens = publicMintLimit;

        await myCollection
          .connect(notWhitelisted)
          .mint(wantedNumberOfTokens, [], {
            value: tokenPrice.mul(wantedNumberOfTokens),
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
        expect(await myCollection.balanceOf(notWhitelisted.address)).to.equal(
          0,
        );

        await myCollection.airdrop([notWhitelisted.address], [1]);

        const wantedNumberOfTokens = publicMintLimit;

        await myCollection
          .connect(notWhitelisted)
          .mint(wantedNumberOfTokens, [], {
            value: tokenPrice.mul(wantedNumberOfTokens),
          });

        expect(await myCollection.balanceOf(notWhitelisted.address)).to.equal(
          publicMintLimit.add(1),
        );
      });
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
    describe('Toggle functions', function() {
      it('should toggle minting', async function() {
        expect(await myCollection.mintActive()).to.equal(false);

        await myCollection.toggleMinting();

        expect(await myCollection.mintActive()).to.equal(true);
      });

      it('should toggle whitelist mint', async function() {
        expect(await myCollection.whitelistMintActive()).to.equal(true);

        await myCollection.toggleWhitelistOnly();

        expect(await myCollection.whitelistMintActive()).to.equal(false);
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
          .mint(1, getMerkleProof(whitelist, whitelisted1.address), {
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
