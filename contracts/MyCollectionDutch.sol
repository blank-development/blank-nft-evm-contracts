// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.15;

import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

error InvalidCaller();
error AuctionNotStarted();
error NoMoreTokensLeft();
error InvalidValue();
error MintLimitReached();
error MintingDisabled();
error ContractSealed();

contract MyCollectionDutch is ERC721A, ERC2981, Ownable {
    string private baseURI;
    bool public contractSealed = false;

    bool public publicMintActive = false;
    uint256 public constant TOKEN_PUBLIC_PRICE = 0.3 ether;
    uint256 public constant TOKEN_MAX_SUPPLY = 4000;
    uint256 public constant TOKEN_MINT_LIMIT = 3;

    uint256 public constant TOKEN_AUCTION_SUPPLY = 2000;
    uint256 public immutable AUCTION_START_TIME;
    uint256 public constant AUCTION_START_PRICE = 0.5 ether;
    uint256 public constant AUCTION_END_PRICE = 0.05 ether;
    uint256 public constant AUCTION_PRICE_CURVE_LENGTH = 1440 minutes; // 1 day
    uint256 public constant AUCTION_DROP_INTERVAL = 30 minutes;
    uint256 public constant AUCTION_DROP_PER_STEP =
        (AUCTION_START_PRICE - AUCTION_END_PRICE) /
            (AUCTION_PRICE_CURVE_LENGTH / AUCTION_DROP_INTERVAL);

    address public constant ROYALTY_RECIPIENT =
        0xE5F135b20F496189FB6C915bABc53e0A70Ff6A1f;

    constructor(string memory initialURI, uint256 startTime)
        ERC721A("MyCollectionDutch", "COLLECTION")
    {
        AUCTION_START_TIME = startTime;

        baseURI = initialURI;

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

    function auctionMint(uint256 quantity) external payable {
        if (msg.sender != tx.origin) revert InvalidCaller();
        if (block.timestamp < AUCTION_START_TIME) revert AuctionNotStarted();
        if (_totalMinted() + quantity > TOKEN_AUCTION_SUPPLY)
            revert NoMoreTokensLeft();

        uint256 finalTokenBalance;
        unchecked {
            // Get amount minted from owner auxiliary data
            finalTokenBalance = _getAux(msg.sender) + quantity;

            if (msg.value < getCurrentPrice() * quantity) revert InvalidValue();
        }

        if (finalTokenBalance > TOKEN_MINT_LIMIT) revert MintLimitReached();

        // Set owner auxiliary data to final amount minted
        _setAux(msg.sender, uint64(finalTokenBalance));

        _mint(msg.sender, quantity);
    }

    function publicMint(uint256 quantity) external payable {
        if (msg.sender != tx.origin) revert InvalidCaller();
        if (!publicMintActive) revert MintingDisabled();
        if (_totalMinted() + quantity > TOKEN_MAX_SUPPLY)
            revert NoMoreTokensLeft();

        uint256 finalTokenBalance;
        unchecked {
            // Get amount minted from owner auxiliary data
            finalTokenBalance = _getAux(msg.sender) + quantity;

            if (msg.value < TOKEN_PUBLIC_PRICE * quantity)
                revert InvalidValue();
        }

        if (finalTokenBalance > TOKEN_MINT_LIMIT) revert MintLimitReached();

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
        publicMintActive = !publicMintActive;
    }

    function reveal(string calldata newUri) external onlyOwner {
        if (contractSealed) revert ContractSealed();

        baseURI = newUri;
    }

    function sealContractPermanently() external onlyOwner {
        if (contractSealed) revert ContractSealed();

        contractSealed = true;
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

    function getCurrentPrice() public view returns (uint256) {
        if (block.timestamp < AUCTION_START_TIME) {
            return AUCTION_START_PRICE;
        }

        if (
            block.timestamp - AUCTION_START_TIME >= AUCTION_PRICE_CURVE_LENGTH
        ) {
            return AUCTION_END_PRICE;
        } else {
            uint256 steps = (block.timestamp - AUCTION_START_TIME) /
                AUCTION_DROP_INTERVAL;
            return AUCTION_START_PRICE - (steps * AUCTION_DROP_PER_STEP);
        }
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721A, ERC2981)
        returns (bool)
    {
        return
            ERC721A.supportsInterface(interfaceId) ||
            ERC2981.supportsInterface(interfaceId);
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    function _startTokenId() internal pure override returns (uint256) {
        return 1;
    }
}
