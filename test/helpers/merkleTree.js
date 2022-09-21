const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
const { mockWhitelistedAddresses } = require("./mockWhitelistedAddresses");

const getMerkleProof = (addr) => {
  const leaves = mockWhitelistedAddresses.map((addr) => keccak256(addr));

  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });

  const leaf = keccak256(addr);

  const proof = tree.getHexProof(leaf);

  return proof;
};

module.exports = { getMerkleProof };
