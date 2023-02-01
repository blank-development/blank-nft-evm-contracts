const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

const getMerkleProof = (whitelist, addr) => {
  const leaves = whitelist.map(addr => keccak256(addr));
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const leaf = keccak256(addr);
  const proof = tree.getHexProof(leaf);
  return proof;
};

const getMerkleTreeRoot = whitelist => {
  const leaves = whitelist.map(addr => keccak256(addr));
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const root = tree.getRoot().toString('hex');
  return root;
};

module.exports = { getMerkleProof, getMerkleTreeRoot };
