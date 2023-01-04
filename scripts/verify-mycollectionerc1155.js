async function main() {
  const name = "";
  const symbol = "";
  const initialURI = "";
  const merkleRoot = "";
  const contractAddress = "";

  const initialURIFormatted = `${initialURI}?`;

  await run("verify:verify", {
    address: contractAddress,
    constructorArguments: [name, symbol, initialURIFormatted, merkleRoot],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
