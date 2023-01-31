// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.17;

import 'erc721a-upgradeable/contracts/ERC721AUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "operator-filter-registry/src/DefaultOperatorFilterer.sol";

contract ERC721Implementation is ERC721AUpgradeable, ERC2981Upgradeable, DefaultOperatorFilterer, OwnableUpgradeable {
    string public baseURI;
    bytes32 public merkleRoot;
    bool public isOperatorFiltererEnabled;

    struct SaleConfig {
        bool mintActive;
        bool whitelistMintActive;

        uint64 tokenPrice;
        uint64 tokenMaxSupply;
        uint64 publicMintLimit;
        uint64 whitelistMintLimit;
    }

    SaleConfig public saleConfig;

    error InvalidCaller();
    error MintingDisabled();
    error NoMoreTokensLeft();
    error InvalidValueProvided();
    error MintLimitReached();
    error NotWhitelisted();
    error ContractSealed();

    function initialize(
        string memory _name,
        string memory _symbol,
        bytes32 _merkleRoot) initializerERC721A initializer external 
    {
        __ERC721A_init(_name, _symbol);
        __Ownable_init();
        __ERC2981_init();

        merkleRoot = _merkleRoot;
    }

    function mint(uint256 quantity, bytes32[] calldata merkleProof)
        external
        payable
    {
        if (msg.sender != tx.origin) revert InvalidCaller();

        if (!saleConfig.mintActive) revert MintingDisabled();

        // Revert if total supply will exceed the limit
        if (_totalMinted() + quantity > saleConfig.tokenMaxSupply) revert NoMoreTokensLeft();

        // Revert if not enough ETH is sent
        if (msg.value < saleConfig.tokenPrice * quantity) revert InvalidValueProvided();

        uint256 finalTokenBalance;
        unchecked {
            // Get amount minted from owner auxiliary data
            finalTokenBalance = _getAux(msg.sender) + quantity;
        }

        if (saleConfig.whitelistMintActive) {
            // Revert if final token balance is above whitelist limit
            if (finalTokenBalance > saleConfig.whitelistMintLimit) revert MintLimitReached();

            // Revert if merkle proof is not valid
            if (!MerkleProof.verifyCalldata(merkleProof, merkleRoot, keccak256(abi.encodePacked(msg.sender)))) revert NotWhitelisted();
        } else {
            // Revert if final token balance is above public limit
            if (finalTokenBalance > saleConfig.publicMintLimit) revert MintLimitReached();
        }

        // Revert if final token balance is above public limit
        _setAux(msg.sender, uint64(finalTokenBalance));
        _mint(msg.sender, quantity);
    }

    function airdrop(address[] calldata to, uint64[] calldata quantity)
        external
        onlyOwner
    {
        address[] memory recipients = to;

        for (uint64 i = 0; i < recipients.length; ) {
            _mint(recipients[i], quantity[i]);

            unchecked {
                ++i;
            }
        }

        if (_totalMinted() > saleConfig.tokenMaxSupply) revert NoMoreTokensLeft();
    }

    function burn(uint256 tokenId) external {
        _burn(tokenId, true);
    }

    function toggleMinting() external onlyOwner {
        saleConfig.mintActive = !saleConfig.mintActive;
    }

    function toggleWhitelistOnly() external onlyOwner {
        saleConfig.whitelistMintActive = !saleConfig.whitelistMintActive;
    }

    function toggleOperatorFilterer() external onlyOwner{
        isOperatorFiltererEnabled = !isOperatorFiltererEnabled;
    }

    function setTokenPrice(uint64 tokenPrice) external onlyOwner {
        saleConfig.tokenPrice = tokenPrice;
    }

    function setMintLimits(
        uint64 tokenMaxSupply,
        uint64 publicMintLimit,
        uint64 whitelistMintLimit
    ) external onlyOwner {
        saleConfig.tokenMaxSupply = tokenMaxSupply;
        saleConfig.publicMintLimit = publicMintLimit;
        saleConfig.whitelistMintLimit = whitelistMintLimit;
    }

    function setBaseURI(string calldata newUri) external onlyOwner {
        baseURI = newUri;
    }

    function setRoyalties(address receiver, uint96 feeNumerator)
        external
        onlyOwner
    {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    function withdrawAllFunds() external onlyOwner {
        require(address(this).balance > 0, "No amount to withdraw");
        payable(msg.sender).transfer(address(this).balance);
    }

    function amountMinted(address user) external view returns (uint64) {
        // Returns amount minted from owner auxiliary data
        return _getAux(user);
    }

    function _beforeTokenTransfers(
        address from,
        address to,
        uint256 startTokenId,
        uint256 quantity
    ) internal virtual override{
        if(isOperatorFiltererEnabled){
         _checkFilterOperator(msg.sender);
        }

        super._beforeTokenTransfers(from, to, startTokenId, quantity);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC2981Upgradeable, ERC721AUpgradeable)
        returns (bool)
    {
        return
            ERC721AUpgradeable.supportsInterface(interfaceId) ||
            ERC2981Upgradeable.supportsInterface(interfaceId);
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    function _startTokenId() internal pure override returns (uint256) {
        return 1;
    }
}
