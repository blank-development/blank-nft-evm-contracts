const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contract with the account: ', deployer.address);

  const ERC721Implementation = await ethers.getContractFactory(
    'ERC721Implementation',
  );
  const implementation = await ERC721Implementation.deploy();
  await implementation.deployed();

  console.log(
    'Success! ERC721Implementation was deployed to: ',
    implementation.address,
  );
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
