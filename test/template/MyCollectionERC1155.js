const { expect } = require('chai');
const { ethers } = require('hardhat');
const { getMerkleProof } = require('../helpers/merkleTree');

describe('MyCollectionERC1155', function() {
  let myCollectionERC1155;
  let teamWallet;

  beforeEach(async function() {
    [
      owner,
      ,
      whitelisted1,
      whitelisted2,
      whitelisted3,
      notWhitelisted,
    ] = await ethers.getSigners();

    const MyCollectionERC1155 = await ethers.getContractFactory(
      'MyCollectionERC1155',
    );
    myCollectionERC1155 = await MyCollectionERC1155.deploy(
      'My Collection',
      'COLLECTION',
      'ipfs://QmSBxebqcuP8GyUxaFVEDqpsmbcjNMxg5y3i1UAHLkhHg5/',
      '0xcd03b1680c151ca091ff2660b40d4c36d9248c782c7eac1643157917cbf89dec',
    );
    await myCollectionERC1155.deployed();

    tokenPrice = await myCollectionERC1155.tokenPrice();
  });

  describe('Mint general', function() {
    it('should not mint if minting is disabled', async function() {
      await expect(
        myCollectionERC1155
          .connect(whitelisted1)
          .mint(1, 1, getMerkleProof(whitelisted1.address), {
            value: tokenPrice,
          }),
      ).to.be.revertedWithCustomError(myCollectionERC1155, 'MintingDisabled');
    });

    it('should not mint if user dont provide enough ETH', async function() {
      await myCollectionERC1155.toggleMinting();

      await expect(
        myCollectionERC1155
          .connect(whitelisted1)
          .mint(1, 1, getMerkleProof(whitelisted1.address), {
            value: tokenPrice.sub(1),
          }),
      ).to.be.revertedWithCustomError(
        myCollectionERC1155,
        'InvalidValueProvided',
      );
    });

    it('should not mint if there are no tokens left for that token id', async function() {
      await myCollectionERC1155.toggleMinting();

      const tokenMaxSupply = (await myCollectionERC1155.tokenSupplies(1))
        .maximum;
      const wantedNumberOfTokens = tokenMaxSupply.add(1);

      await expect(
        myCollectionERC1155
          .connect(whitelisted1)
          .mint(1, wantedNumberOfTokens, getMerkleProof(whitelisted1.address), {
            value: tokenPrice.mul(wantedNumberOfTokens),
          }),
      ).to.be.revertedWithCustomError(myCollectionERC1155, 'NoMoreTokensLeft');
    });

    it('should mint token id that has been addded by team', async function() {
      await myCollectionERC1155.toggleMinting();

      await myCollectionERC1155.setTokenSupply(2, 20);

      await myCollectionERC1155
        .connect(whitelisted1)
        .mint(2, 1, getMerkleProof(whitelisted1.address), {
          value: tokenPrice,
        });

      expect(
        await myCollectionERC1155.balanceOf(whitelisted1.address, 2),
      ).to.be.equal(1);
    });

    it('should not mint token id that has not been added by team', async function() {
      await myCollectionERC1155.toggleMinting();

      await expect(
        myCollectionERC1155
          .connect(whitelisted1)
          .mint(2, 1, getMerkleProof(whitelisted1.address), {
            value: tokenPrice,
          }),
      ).to.be.revertedWithCustomError(myCollectionERC1155, 'InvalidToken');
    });
  });

  describe('Whitelist mint phase', function() {
    beforeEach(async function() {
      await myCollectionERC1155.toggleMinting();
    });

    it('should mint if caller is whitelisted and respects limitations', async function() {
      expect(
        await myCollectionERC1155.balanceOf(whitelisted1.address, 1),
      ).to.equal(0);

      await myCollectionERC1155
        .connect(whitelisted1)
        .mint(1, 1, getMerkleProof(whitelisted1.address), {
          value: tokenPrice,
        });

      expect(
        await myCollectionERC1155.balanceOf(whitelisted1.address, 1),
      ).to.equal(1);
    });

    it('should not mint if caller is not whitelisted', async function() {
      await expect(
        myCollectionERC1155
          .connect(notWhitelisted)
          .mint(1, 1, getMerkleProof(notWhitelisted.address), {
            value: tokenPrice,
          }),
      ).to.be.revertedWithCustomError(myCollectionERC1155, 'NotWhitelisted');
    });

    it('should not mint if not whitelisted caller uses proof of another whitelisted address', async function() {
      await expect(
        myCollectionERC1155
          .connect(notWhitelisted)
          .mint(1, 1, getMerkleProof(whitelisted1.address), {
            value: tokenPrice,
          }),
      ).to.be.revertedWithCustomError(myCollectionERC1155, 'NotWhitelisted');
    });

    it('should not mint if whitelisted caller uses proof of another whitelisted address', async function() {
      await expect(
        myCollectionERC1155
          .connect(whitelisted1)
          .mint(1, 1, getMerkleProof(whitelisted2.address), {
            value: tokenPrice,
          }),
      ).to.be.revertedWithCustomError(myCollectionERC1155, 'NotWhitelisted');
    });
  });

  describe('Public mint phase', function() {
    beforeEach(async function() {
      await myCollectionERC1155.toggleMinting();

      await myCollectionERC1155.toggleWhitelistOnly();
    });

    it('should mint if caller is any user and respects limitations', async function() {
      expect(
        await myCollectionERC1155.balanceOf(notWhitelisted.address, 1),
      ).to.equal(0);

      await myCollectionERC1155.connect(notWhitelisted).mint(1, 1, [], {
        value: tokenPrice,
      });

      expect(
        await myCollectionERC1155.balanceOf(notWhitelisted.address, 1),
      ).to.equal(1);
    });
  });

  describe('Interface support', function() {
    it('supports ERC165 interface', async function() {
      expect(
        await myCollectionERC1155.supportsInterface('0x01ffc9a7'),
      ).to.equal(true);
    });

    it('supports ERC1155 interface', async function() {
      expect(
        await myCollectionERC1155.supportsInterface('0xd9b67a26'),
      ).to.equal(true);
    });

    it('supports ERC1155Metadata interface', async function() {
      expect(
        await myCollectionERC1155.supportsInterface('0x0e89341c'),
      ).to.equal(true);
    });
  });

  describe('Only owner functions', function() {
    describe('Toggle functions', function() {
      it('should toggle minting', async function() {
        expect(await myCollectionERC1155.mintActive()).to.equal(false);

        await myCollectionERC1155.toggleMinting();

        expect(await myCollectionERC1155.mintActive()).to.equal(true);
      });

      it('should toggle whitelist mint', async function() {
        expect(await myCollectionERC1155.whitelistMintActive()).to.equal(true);

        await myCollectionERC1155.toggleWhitelistOnly();

        expect(await myCollectionERC1155.whitelistMintActive()).to.equal(false);
      });

      it('should not allow to toggle minting if caller is not owner', async function() {
        await expect(
          myCollectionERC1155.connect(whitelisted1).toggleMinting(),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('should not allow to toggle whitelist mint if caller is not owner', async function() {
        await expect(
          myCollectionERC1155.connect(whitelisted1).toggleWhitelistOnly(),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });
    });

    describe('Airdrop tokens', function() {
      it('should airdrop tokens correctly', async function() {
        const to = [whitelisted3.address, notWhitelisted.address];
        const tokenId = [1, 1];
        const quantity = [3, 4];

        await myCollectionERC1155.airdrop(to, tokenId, quantity);

        expect(await myCollectionERC1155.balanceOf(to[0], tokenId[0])).to.equal(
          3,
        );
        expect(await myCollectionERC1155.balanceOf(to[1], tokenId[1])).to.equal(
          4,
        );
      });

      it('should not allow to airdrop more tokens than particular token max supply', async function() {
        const tokenMaxSupply = (await myCollectionERC1155.tokenSupplies(1))
          .maximum;

        const to = [
          whitelisted3.address,
          notWhitelisted.address,
          whitelisted2.address,
        ];
        const tokenId = [1, 1, 1];
        const quantity = [4, tokenMaxSupply.sub(2), 3];

        await expect(
          myCollectionERC1155.airdrop(to, tokenId, quantity),
        ).to.be.revertedWithCustomError(
          myCollectionERC1155,
          'NoMoreTokensLeft',
        );
      });

      it('should not allow to airdrop if caller is not owner', async function() {
        const to = [whitelisted3.address, notWhitelisted.address];
        const tokenId = [1, 1];
        const quantity = [3, 4];

        await expect(
          myCollectionERC1155
            .connect(whitelisted1)
            .airdrop(to, tokenId, quantity),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });
    });

    describe('Set maximum supply for token', function() {
      it('should set correct maximum supply for token if caller is owner', async function() {
        expect((await myCollectionERC1155.tokenSupplies(5)).maximum).to.equal(
          0,
        );

        await myCollectionERC1155.setTokenSupply(5, 500);

        expect((await myCollectionERC1155.tokenSupplies(5)).maximum).to.equal(
          500,
        );
      });

      it('should not set maximum supply for token if caller is not owner', async function() {
        await expect(
          myCollectionERC1155.connect(notWhitelisted).setTokenSupply(5, 500),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });
    });

    describe('Set token price', function() {
      it('should set token price correctly if caller is owner', async function() {
        await myCollectionERC1155.setTokenPrice(50000);

        expect(await myCollectionERC1155.tokenPrice()).to.equal(50000);
      });

      it('should not set token price if caller is not owner', async function() {
        await expect(
          myCollectionERC1155.connect(notWhitelisted).setTokenPrice(50000),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });
    });

    describe('Query URI', function() {
      it('should query correct uri for existent token', async function() {
        await myCollectionERC1155.airdrop([notWhitelisted.address], [1], [1]);

        expect(await myCollectionERC1155.uri(1)).to.equal(
          'ipfs://QmSBxebqcuP8GyUxaFVEDqpsmbcjNMxg5y3i1UAHLkhHg5/1',
        );
      });

      it('should not let query uri for nonexistent token', async function() {
        await expect(myCollectionERC1155.uri(1)).to.be.revertedWithCustomError(
          myCollectionERC1155,
          'NonexistentToken',
        );
      });
    });

    describe('Reveal art', function() {
      it('should reveal correctly if contract is not sealed', async function() {
        await myCollectionERC1155.airdrop([whitelisted1.address], [1], [1]);

        expect(await myCollectionERC1155.uri(1)).to.equal(
          'ipfs://QmSBxebqcuP8GyUxaFVEDqpsmbcjNMxg5y3i1UAHLkhHg5/1',
        );

        await myCollectionERC1155.reveal(
          'ipfs://QmbJxj9yTDhDHXYQUHjyz74GxP1VCwF3pkVWCvBTejF3kD/',
        );

        expect(await myCollectionERC1155.uri(1)).to.equal(
          'ipfs://QmbJxj9yTDhDHXYQUHjyz74GxP1VCwF3pkVWCvBTejF3kD/1',
        );
      });

      it('should not allow to reveal if contract is already sealed', async function() {
        await myCollectionERC1155.sealContractPermanently();

        await expect(
          myCollectionERC1155.reveal(
            'ipfs://QmbJxj9yTDhDHXYQUHjyz74GxP1VCwF3pkVWCvBTejF3kD/',
          ),
        ).to.be.revertedWithCustomError(myCollectionERC1155, 'ContractSealed');
      });

      it('should not allow to reveal art if caller is not owner', async function() {
        await expect(
          myCollectionERC1155
            .connect(whitelisted1)
            .reveal('ipfs://QmbJxj9yTDhDHXYQUHjyz74GxP1VCwF3pkVWCvBTejF3kD/'),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });
    });

    describe('Seal contract', function() {
      it('should seal contract', async function() {
        expect(await myCollectionERC1155.contractSealed()).to.equal(false);

        await myCollectionERC1155.sealContractPermanently();

        expect(await myCollectionERC1155.contractSealed()).to.equal(true);
      });

      it('should not allow to seal contract if contract is already sealed', async function() {
        await myCollectionERC1155.sealContractPermanently();

        await expect(
          myCollectionERC1155.sealContractPermanently(),
        ).to.be.revertedWithCustomError(myCollectionERC1155, 'ContractSealed');
      });

      it('should not allow to seal contract if caller is not owner', async function() {
        await expect(
          myCollectionERC1155.connect(whitelisted1).sealContractPermanently(),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });
    });

    describe('Withdraw funds', function() {
      it('should withdraw funds to owner correctly', async function() {
        await myCollectionERC1155.toggleMinting();
        await myCollectionERC1155.toggleWhitelistOnly();
        await myCollectionERC1155.connect(notWhitelisted).mint(1, 1, [], {
          value: tokenPrice,
        });

        const balanceBefore = await ethers.provider.getBalance(owner.address);

        await myCollectionERC1155.withdrawAllFunds();

        const balanceAfter = await ethers.provider.getBalance(owner.address);
        expect(balanceAfter).to.be.gt(balanceBefore);
      });

      it('should not allow to withdraw funds if caller is not owner', async function() {
        await expect(
          myCollectionERC1155.connect(whitelisted1).withdrawAllFunds(),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });
    });
  });
});
