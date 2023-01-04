async function main() {
  const initialURI = "";
  const merkleRoot = "";
  const royaltyRecipient = "";
  const royalties = 1000;
  const contractAddress = "";

  const initialURIFormatted = `${initialURI}?`;

  await run("verify:verify", {
    address: contractAddress,
    constructorArguments: [
      initialURIFormatted,
      merkleRoot,
      royaltyRecipient,
      royalties,
    ],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
