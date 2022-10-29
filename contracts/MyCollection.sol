// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.15;

import "erc721a/contracts/extensions/ERC721ABurnable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

error InvalidCaller();
error MintingDisabled();
error NoMoreTokensLeft();
error InvalidValue();
error MintLimitReached();
error NotWhitelisted();
error ContractSealed();

contract MyCollection is ERC721ABurnable, ERC2981, Ownable {
    string private s_baseURI;
    bool public s_contractSealed = false;

    bool public s_mintActive = false;
    uint256 public constant TOKEN_PRICE = 0.08 ether;
    uint256 public constant TOKEN_MAX_SUPPLY = 4000;
    uint256 public constant PUBLIC_MINT_LIMIT = 5;

    bool public s_whitelistOnly = true;
    uint256 public constant WHITELIST_MINT_LIMIT = 1;
    bytes32 private constant WHITELIST_MERKLE_ROOT =
        0xcd03b1680c151ca091ff2660b40d4c36d9248c782c7eac1643157917cbf89dec;

    address public constant ROYALTY_RECIPIENT =
        0xE5F135b20F496189FB6C915bABc53e0A70Ff6A1f;

    constructor(string memory initialURI)
        ERC721A("MyCollection", "COLLECTION")
    {
        s_baseURI = initialURI;

        _setDefaultRoyalty(ROYALTY_RECIPIENT, 1000); // 10%

        /**
         * Mint one token, so collection appears on the NFT marketplace.
         */
        _mint(ROYALTY_RECIPIENT, 1);

        /**
         * Mint bunch of tokens at deployment using ERC2309 for marketing etc.
         * This will be cheaper than if we called the airdrop function later on.
         *
         * It is more gas optimal to transfer bulk minted tokens in ascending
         * token ID order. But if that will not be the case, we should use
         * _initializeOwnershipAt to reduce first-time transfer costs.
         */
        // _mintERC2309(ROYALTY_RECIPIENT, 100);
        // for (uint256 i; i < 20; ++i) {
        //     _initializeOwnershipAt(i * 5);
        // }
    }

    function mint(uint256 quantity, bytes32[] calldata merkleProof)
        external
        payable
    {
        if (msg.sender != tx.origin) revert InvalidCaller();
        if (!s_mintActive) revert MintingDisabled();
        if (_totalMinted() + quantity > TOKEN_MAX_SUPPLY)
            revert NoMoreTokensLeft();

        uint256 finalTokenBalance;
        unchecked {
            // Get amount minted from owner auxiliary data
            finalTokenBalance = _getAux(msg.sender) + quantity;

            if (msg.value < TOKEN_PRICE * quantity) revert InvalidValue();
        }

        if (s_whitelistOnly) {
            if (finalTokenBalance > WHITELIST_MINT_LIMIT)
                revert MintLimitReached();

            bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
            if (
                !MerkleProof.verifyCalldata(
                    merkleProof,
                    WHITELIST_MERKLE_ROOT,
                    leaf
                )
            ) revert NotWhitelisted();
        } else {
            if (finalTokenBalance > PUBLIC_MINT_LIMIT)
                revert MintLimitReached();
        }

        // Set owner auxiliary data to final amount minted
        _setAux(msg.sender, uint64(finalTokenBalance));

        _mint(msg.sender, quantity);
    }

    function airdrop(address[] calldata to, uint256[] calldata quantity)
        external
        onlyOwner
    {
        address[] memory recipients = to;

        for (uint256 i = 0; i < recipients.length; ) {
            _mint(recipients[i], quantity[i]);

            unchecked {
                ++i;
            }
        }

        if (_totalMinted() > TOKEN_MAX_SUPPLY) revert NoMoreTokensLeft();
    }

    function toggleMinting() external onlyOwner {
        s_mintActive = !s_mintActive;
    }

    function toggleWhitelistOnly() external onlyOwner {
        s_whitelistOnly = !s_whitelistOnly;
    }

    function reveal(string calldata newUri) external onlyOwner {
        if (s_contractSealed) revert ContractSealed();

        s_baseURI = newUri;
    }

    function sealContractPermanently() external onlyOwner {
        if (s_contractSealed) revert ContractSealed();

        s_contractSealed = true;
    }

    function setDefaultRoyalty(address receiver, uint96 feeNumerator)
        external
        onlyOwner
    {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    function withdrawAllFunds() external onlyOwner {
        payable(ROYALTY_RECIPIENT).transfer(address(this).balance);
    }

    function amountMinted(address user) external view returns (uint64) {
        // Returns amount minted from owner auxiliary data
        return _getAux(user);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC2981, ERC721A, IERC721A)
        returns (bool)
    {
        return
            ERC721A.supportsInterface(interfaceId) ||
            ERC2981.supportsInterface(interfaceId);
    }

    function _baseURI() internal view override returns (string memory) {
        return s_baseURI;
    }

    function _startTokenId() internal view override returns (uint256) {
        return 1;
    }
}
