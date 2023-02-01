const { ethers } = require("hardhat");

async function main() {
  const initialURI = "";
  const auctionStartTime = 1663624800;

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contract with the account: ", deployer.address);

  const initialURIFormatted = `${initialURI}?`;
  const MyCollectionDutch = await ethers.getContractFactory(
    "MyCollectionDutch"
  );
  const myCollectionDutch = await MyCollectionDutch.deploy(
    initialURIFormatted,
    auctionStartTime
  );
  await myCollectionDutch.deployed();

  console.log(
    "Success! MyCollectionDutch was deployed to: ",
    myCollectionDutch.address
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
