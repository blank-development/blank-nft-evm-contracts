const { ethers } = require("hardhat");

async function main() {
  const initialURI = "";
  const merkleRoot = "";
  const royaltyRecipient = "";
  const royalties = 1000; // 10%
  const crossmintWallet = "";

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contract with the account: ", deployer.address);

  const initialURIFormatted = `${initialURI}?`;
  const MyCollection = await ethers.getContractFactory("MyCollection");
  const myCollection = await MyCollection.deploy(
    initialURIFormatted,
    merkleRoot,
    royaltyRecipient,
    royalties,
    crossmintWallet
  );
  await myCollection.deployed();

  console.log("Success! MyCollection was deployed to: ", myCollection.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
