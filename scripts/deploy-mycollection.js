const { ethers } = require('hardhat');

async function main() {
  const initialURI = 'ipfs://QmVqodXFfpUU13GJDetcE2UtPLWMBsZubX6ZnhU3XDWhmJ?';
  const merkleRoot =
    '0x1f8178188c1b340f34b77f6349435822d75c2695f16ca932142629757831b92f';

  const [deployer] = await ethers.getSigners();
  console.log('Deploying contract with the account: ', deployer.address);

  const initialURIFormatted = `${initialURI}?`;
  const MyCollection = await ethers.getContractFactory('MyCollection');
  const myCollection = await MyCollection.deploy(
    initialURIFormatted,
    merkleRoot,
  );
  await myCollection.deployed();

  console.log('Success! MyCollection was deployed to: ', myCollection.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
