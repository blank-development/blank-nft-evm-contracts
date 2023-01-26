const { ethers } = require("hardhat");

async function main() {
  const initialURI = "ipfs://QmVqodXFfpUU13GJDetcE2UtPLWMBsZubX6ZnhU3XDWhmJ?";
  const merkleRoot = "";
  const royaltyRecipient = "0x5f148706ce473A637146D13bdE23F4160D1F0F62";
  const royalties = 1000; // 5%

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contract with the account: ", deployer.address);

  const initialURIFormatted = `${initialURI}?`;
  const MyCollection = await ethers.getContractFactory("MyCollection");
  const myCollection = await MyCollection.deploy(
    initialURIFormatted,
    merkleRoot,
    royaltyRecipient,
    royalties
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
