// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract MyCollectionERC1155 is ERC1155, Ownable {
    string public name;
    string public symbol;

    string public BASE_URI;

    bool public contractSealed = false;
    bool public mintActive = false;
    bool public whitelistMintActive = true;

    uint256 public tokenPrice = 0.2 ether;

    bytes32 public immutable merkleRoot;

    struct TokenSupply {
        uint128 maximum;
        uint128 current;
    }

    mapping(uint256 => TokenSupply) public tokenSupplies;

    error InvalidCaller();
    error MintingDisabled();
    error InvalidToken();
    error NoMoreTokensLeft();
    error InvalidValueProvided();
    error NotWhitelisted();
    error ContractSealed();
    error NonexistentToken();

    constructor(string memory _name, string memory _symbol, string memory _baseUri, bytes32 _merkleRoot) ERC1155("") {
        name = _name;
        symbol = _symbol;
        BASE_URI = _baseUri;
        merkleRoot = _merkleRoot;

        tokenSupplies[1].maximum = 300;
    }

    function mint(
        uint256 tokenId,
        uint256 quantity,
        bytes32[] calldata merkleProof
    ) external payable {
        if (!mintActive) revert MintingDisabled();

        TokenSupply memory tokenSupply = tokenSupplies[tokenId];
        uint256 finalTokenBalance = quantity + tokenSupply.current;

        if (tokenSupply.maximum == 0) revert InvalidToken();
        if (finalTokenBalance > tokenSupply.maximum) revert NoMoreTokensLeft();
        if (msg.value < tokenPrice * quantity) revert InvalidValueProvided();
        if (whitelistMintActive && !MerkleProof.verify(merkleProof, merkleRoot, keccak256(abi.encodePacked(msg.sender)))) revert NotWhitelisted();

        tokenSupplies[tokenId].current = uint128(finalTokenBalance);

        _mint(msg.sender, tokenId, quantity, "");
    }

    function airdrop(
        address[] calldata recipients,
        uint256[] calldata tokenIds,
        uint256[] calldata quantities
    ) external onlyOwner {
        address[] memory recipients_ = recipients;

        uint256 quantity;
        uint256 tokenId;

        for (uint256 i = 0; i < recipients_.length; ) {
            quantity = quantities[i];
            tokenId = tokenIds[i];

            TokenSupply storage tokenSupply = tokenSupplies[tokenId];
            uint256 finalTokenBalance = quantity + tokenSupply.current;

            if (finalTokenBalance > tokenSupply.maximum)
                revert NoMoreTokensLeft();

            tokenSupply.current = uint128(finalTokenBalance);

            _mint(recipients_[i], tokenId, quantity, "");

            unchecked {
                ++i;
            }
        }
    }

    function setTokenSupply(uint256 tokenId, uint256 supply)
        external
        onlyOwner
    {
        tokenSupplies[tokenId].maximum = uint128(supply);
    }

    function setTokenPrice(uint256 price) external onlyOwner {
        tokenPrice = price;
    }

    function toggleMinting() external onlyOwner {
        mintActive = !mintActive;
    }

    function toggleWhitelistOnly() external onlyOwner {
        whitelistMintActive = !whitelistMintActive;
    }

    function reveal(string calldata newURI) external onlyOwner {
        if (contractSealed) revert ContractSealed();

        BASE_URI = newURI;
    }

    function sealContractPermanently() external onlyOwner {
        if (contractSealed) revert ContractSealed();

        contractSealed = true;
    }

    function withdrawAllFunds() external onlyOwner {
        payable(msg.sender).transfer(address(this).balance);
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        if (tokenSupplies[tokenId].current == 0) revert NonexistentToken();

        return string(abi.encodePacked(BASE_URI, Strings.toString(tokenId)));
    }
}
