// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

error InvalidCaller();
error MintingDisabled();
error InvalidToken();
error NoMoreTokensLeft();
error InvalidValue();
error NotWhitelisted();
error ContractSealed();
error NonexistentToken();

contract MyCollectionERC1155 is ERC1155, Ownable {
    string public constant name = "NFGrapevine";
    string public constant symbol = "NFGRAPEVINE";

    string private s_baseURI;
    bool public s_contractSealed = false;

    bool public s_mintActive = false;
    uint256 public s_tokenPrice = 0.2 ether;

    struct TokenSupply {
        uint128 maximum;
        uint128 current;
    }

    mapping(uint256 => TokenSupply) public s_tokenSupplies;

    bool public s_whitelistOnly = true;
    bytes32 private constant WHITELIST_MERKLE_ROOT =
        0xcd03b1680c151ca091ff2660b40d4c36d9248c782c7eac1643157917cbf89dec;

    address public constant WINEBANK_WALLET =
        0xE5F135b20F496189FB6C915bABc53e0A70Ff6A1f;

    constructor(string memory initialURI) ERC1155("") {
        s_baseURI = initialURI;

        s_tokenSupplies[1].maximum = 300;
    }

    function mint(
        uint256 tokenId,
        uint256 quantity,
        bytes32[] calldata merkleProof
    ) external payable {
        if (msg.sender != tx.origin) revert InvalidCaller();
        if (!s_mintActive) revert MintingDisabled();

        TokenSupply memory tokenSupply = s_tokenSupplies[tokenId];
        uint256 finalTokenBalance = quantity + tokenSupply.current;

        if (tokenSupply.maximum == 0) revert InvalidToken();
        if (finalTokenBalance > tokenSupply.maximum) revert NoMoreTokensLeft();

        unchecked {
            if (msg.value < s_tokenPrice * quantity) revert InvalidValue();
        }

        if (s_whitelistOnly) {
            bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
            if (
                !MerkleProof.verifyCalldata(
                    merkleProof,
                    WHITELIST_MERKLE_ROOT,
                    leaf
                )
            ) revert NotWhitelisted();
        }

        s_tokenSupplies[tokenId].current = uint128(finalTokenBalance);

        _mint(msg.sender, tokenId, quantity, "");

        payable(WINEBANK_WALLET).transfer((msg.value * 15) / 100);
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

            TokenSupply storage tokenSupply = s_tokenSupplies[tokenId];
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
        s_tokenSupplies[tokenId].maximum = uint128(supply);
    }

    function setTokenPrice(uint256 price) external onlyOwner {
        s_tokenPrice = price;
    }

    function toggleMinting() external onlyOwner {
        s_mintActive = !s_mintActive;
    }

    function toggleWhitelistOnly() external onlyOwner {
        s_whitelistOnly = !s_whitelistOnly;
    }

    function reveal(string calldata newURI) external onlyOwner {
        if (s_contractSealed) revert ContractSealed();

        s_baseURI = newURI;
    }

    function sealContractPermanently() external onlyOwner {
        if (s_contractSealed) revert ContractSealed();

        s_contractSealed = true;
    }

    function withdrawAllFunds() external onlyOwner {
        payable(msg.sender).transfer(address(this).balance);
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        if (s_tokenSupplies[tokenId].current == 0) revert NonexistentToken();

        return string(abi.encodePacked(s_baseURI, Strings.toString(tokenId)));
    }
}
