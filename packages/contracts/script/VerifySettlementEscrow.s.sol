// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Script, console2} from "forge-std/Script.sol";

import {SettlementEscrow} from "../src/SettlementEscrow.sol";
import {ArcTestnetConfig} from "./ArcTestnetConfig.sol";

contract VerifySettlementEscrow is Script {
    error WrongChain(uint256 actualChainId);
    error ZeroSettlementAddress();
    error SettlementCodeMissing(address settlement);
    error UsdcMismatch(address actualUsdc);
    error UsdcCodeMissing(address usdc);
    error UsdcDecimalsMismatch(uint8 actualDecimals);
    error MissingRole(bytes32 role, address account);
    error SettlementPaused();
    error ActiveEscrowNotZero(uint256 actualTotal);

    function run() external view {
        if (block.chainid != ArcTestnetConfig.CHAIN_ID) revert WrongChain(block.chainid);

        address settlementAddress = vm.envAddress("SETTLEMENT_CONTRACT_ADDRESS");
        address administrator = vm.envAddress("SETTLE_ADMIN_ADDRESS");
        address operator = vm.envAddress("SETTLE_OPERATOR_ADDRESS");
        address arbitrator = vm.envAddress("SETTLE_ARBITRATOR_ADDRESS");
        address pauser = vm.envAddress("SETTLE_PAUSER_ADDRESS");

        if (settlementAddress == address(0)) revert ZeroSettlementAddress();
        if (settlementAddress.code.length == 0) revert SettlementCodeMissing(settlementAddress);

        SettlementEscrow settlementEscrow = SettlementEscrow(settlementAddress);
        address configuredUsdc = address(settlementEscrow.usdc());
        if (configuredUsdc != ArcTestnetConfig.USDC) revert UsdcMismatch(configuredUsdc);
        if (configuredUsdc.code.length == 0) revert UsdcCodeMissing(configuredUsdc);

        uint8 usdcDecimals = IERC20Metadata(configuredUsdc).decimals();
        if (usdcDecimals != 6) revert UsdcDecimalsMismatch(usdcDecimals);

        _requireRole(settlementEscrow, settlementEscrow.DEFAULT_ADMIN_ROLE(), administrator);
        _requireRole(settlementEscrow, settlementEscrow.OPERATOR_ROLE(), operator);
        _requireRole(settlementEscrow, settlementEscrow.ARBITRATOR_ROLE(), arbitrator);
        _requireRole(settlementEscrow, settlementEscrow.PAUSER_ROLE(), pauser);

        if (settlementEscrow.paused()) revert SettlementPaused();
        uint256 activeEscrow = settlementEscrow.totalActiveEscrow();
        if (activeEscrow != 0) revert ActiveEscrowNotZero(activeEscrow);

        console2.log("Arc Testnet deployment verification passed.");
        console2.log("Chain ID:", block.chainid);
        console2.log("SettlementEscrow:", settlementAddress);
        console2.log("USDC:", configuredUsdc);
        console2.log("Initial active escrow:", activeEscrow);
    }

    function _requireRole(SettlementEscrow settlementEscrow, bytes32 role, address account) private view {
        if (!settlementEscrow.hasRole(role, account)) revert MissingRole(role, account);
    }
}
