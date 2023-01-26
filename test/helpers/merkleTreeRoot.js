const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { whitelistedAddresses } = require('./mockWhitelistedAddresses');

const getMerkleTreeRoot = () => {
  const leaves = whitelistedAddresses.map(addr => keccak256(addr));
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const root = tree.getRoot().toString('hex');
  return root;
};

module.exports = { getMerkleProof };
