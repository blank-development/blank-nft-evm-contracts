async function main() {
  const initialURI = "";
  const auctionStartTime = 1663624800;
  const contractAddress = "";

  const initialURIFormatted = `${initialURI}?`;

  await run("verify:verify", {
    address: contractAddress,
    constructorArguments: [initialURIFormatted, auctionStartTime],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
