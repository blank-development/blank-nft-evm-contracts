const { ethers } = require("hardhat");

async function main() {
  const initialURI = "";

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contract with the account: ", deployer.address);

  const initialURIFormatted = `${initialURI}?`;
  const MyCollection = await ethers.getContractFactory("MyCollection");
  const myCollection = await MyCollection.deploy(initialURIFormatted);
  await myCollection.deployed();

  console.log("Success! MyCollection was deployed to: ", myCollection.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
