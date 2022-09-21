async function main() {
  const initialURI = "";
  const contractAddress = "";

  const initialURIFormatted = `${initialURI}?`;

  await run("verify:verify", {
    address: contractAddress,
    constructorArguments: [initialURIFormatted],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
