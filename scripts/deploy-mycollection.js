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

  await sleep(5000);
  await run("verify:verify", {
    address: myCollection.address,
    constructorArguments: [initialURIFormatted],
  });
}

const sleep = (milliseconds) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
