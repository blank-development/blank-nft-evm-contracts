async function main() {
  await run('verify:verify', {
    address: '0xa5572e8558b2CCf6Cb7f05f04f3803dc577966F1',
    constructorArguments: [],
  });
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
