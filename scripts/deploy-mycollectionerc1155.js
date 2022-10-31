const { ethers } = require("hardhat");

async function main() {
  const initialURI = "";

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contract with the account: ", deployer.address);

  const initialURIFormatted = `${initialURI}?`;
  const MyCollectionERC1155 = await ethers.getContractFactory(
    "MyCollectionERC1155"
  );
  const myCollectionERC1155 = await MyCollectionERC1155.deploy(
    initialURIFormatted
  );
  await myCollectionERC1155.deployed();

  console.log(
    "Success! MyCollectionERC1155 was deployed to: ",
    myCollectionERC1155.address
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
