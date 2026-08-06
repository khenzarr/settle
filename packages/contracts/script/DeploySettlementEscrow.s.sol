// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Script, console2} from "forge-std/Script.sol";

import {SettlementEscrow} from "../src/SettlementEscrow.sol";
import {ArcTestnetConfig} from "./ArcTestnetConfig.sol";

contract DeploySettlementEscrow is Script {
    error WrongChain(uint256 actualChainId);
    error ZeroRoleAddress(string roleName);
    error UsdcCodeMissing(address usdc);
    error UsdcDecimalsMismatch(uint8 actualDecimals);

    function run() external returns (SettlementEscrow settlementEscrow) {
        if (block.chainid != ArcTestnetConfig.CHAIN_ID) revert WrongChain(block.chainid);

        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address administrator = vm.envAddress("SETTLE_ADMIN_ADDRESS");
        address operator = vm.envAddress("SETTLE_OPERATOR_ADDRESS");
        address arbitrator = vm.envAddress("SETTLE_ARBITRATOR_ADDRESS");
        address pauser = vm.envAddress("SETTLE_PAUSER_ADDRESS");

        _requireNonZero(administrator, "administrator");
        _requireNonZero(operator, "operator");
        _requireNonZero(arbitrator, "arbitrator");
        _requireNonZero(pauser, "pauser");

        address usdc = ArcTestnetConfig.USDC;
        if (usdc.code.length == 0) revert UsdcCodeMissing(usdc);
        uint8 usdcDecimals = IERC20Metadata(usdc).decimals();
        if (usdcDecimals != 6) revert UsdcDecimalsMismatch(usdcDecimals);

        address deployer = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);
        settlementEscrow = new SettlementEscrow(usdc, administrator, operator, arbitrator, pauser);
        vm.stopBroadcast();

        console2.log("Chain ID:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("SettlementEscrow:", address(settlementEscrow));
        console2.log("USDC:", usdc);
        console2.log("Administrator:", administrator);
        console2.log("Operator:", operator);
        console2.log("Arbitrator:", arbitrator);
        console2.log("Pauser:", pauser);
    }

    function _requireNonZero(address account, string memory roleName) private pure {
        if (account == address(0)) revert ZeroRoleAddress(roleName);
    }
}
