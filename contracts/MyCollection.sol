// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.15;

import "erc721a/contracts/extensions/ERC721ABurnable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyCollection is ERC721ABurnable, ERC2981, Ownable {
    string public baseURI;

    bool public contractSealed = false;
    bool public mintActive = false;
    bool public whitelistMintActive = true;

    uint256 public constant TOKEN_PRICE = 0.08 ether;
    uint256 public constant TOKEN_MAX_SUPPLY = 4000;
    uint256 public constant PUBLIC_MINT_LIMIT = 5;
    uint256 public constant WHITELIST_MINT_LIMIT = 1;

    bytes32 public immutable merkleRoot;
    address public immutable royaltyRecipient;

    error InvalidCaller();
    error MintingDisabled();
    error NoMoreTokensLeft();
    error InvalidValueProvided();
    error MintLimitReached();
    error NotWhitelisted();
    error ContractSealed();

    constructor(
        string memory _baseUri, 
        bytes32 _merkleRoot,
        address _royaltyRecipient, 
        uint96 _royalties)
        ERC721A("MyCollection", "COLLECTION")
    {
        baseURI = _baseUri;
        royaltyRecipient = _royaltyRecipient;
        merkleRoot = _merkleRoot;

        _setDefaultRoyalty(_royaltyRecipient, _royalties);
    }

    function mint(uint256 quantity, bytes32[] calldata merkleProof) 
        external
        payable
    {
        if (msg.sender != tx.origin) revert InvalidCaller();

        // Revert if mint is not active
        if (!mintActive) revert MintingDisabled();

        // Revert if total supply will exceed the limit
        if (_totalMinted() + quantity > TOKEN_MAX_SUPPLY) revert NoMoreTokensLeft();

        // Revert if not enough ETH is sent
        if (msg.value < TOKEN_PRICE * quantity) revert InvalidValueProvided();

        uint256 finalTokenBalance;
        unchecked {
            // Get amount minted from owner auxiliary data
            finalTokenBalance = _getAux(msg.sender) + quantity;
        }

        if (whitelistMintActive) {
            // Revert if final token balance is above whitelist limit
            if (finalTokenBalance > WHITELIST_MINT_LIMIT) revert MintLimitReached();

            // Revert if merkle proof is not valid
            if (!MerkleProof.verify(merkleProof, merkleRoot, keccak256(abi.encodePacked(msg.sender)))) revert NotWhitelisted();
        } else {
            // Revert if final token balance is above public limit
            if (finalTokenBalance > PUBLIC_MINT_LIMIT) revert MintLimitReached();
        }

        // Save owner auxiliary data to final amount minted
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
        mintActive = !mintActive;
    }

    function toggleWhitelistOnly() external onlyOwner {
        whitelistMintActive = !whitelistMintActive;
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
        payable(royaltyRecipient).transfer(address(this).balance);
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
        return baseURI;
    }

    function _startTokenId() internal pure override returns (uint256) {
        return 1;
    }
}
