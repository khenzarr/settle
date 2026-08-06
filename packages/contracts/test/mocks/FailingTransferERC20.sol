// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FailingTransferERC20 is ERC20 {
    address private _blockedRecipient;

    constructor() ERC20("Failing Mock USDC", "fmUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function setBlockedRecipient(address blockedRecipient) external {
        _blockedRecipient = blockedRecipient;
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        if (to == _blockedRecipient) revert("TRANSFER_BLOCKED");
        return super.transfer(to, value);
    }
}
