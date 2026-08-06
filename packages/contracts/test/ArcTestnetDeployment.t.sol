// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";

import {ArcTestnetConfig} from "../script/ArcTestnetConfig.sol";
import {SettlementEscrow} from "../src/SettlementEscrow.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract ArcTestnetDeploymentTest is Test {
    address private constant ADMIN = address(0x1001);
    address private constant OPERATOR = address(0x1002);
    address private constant ARBITRATOR = address(0x1003);
    address private constant PAUSER = address(0x1004);

    function testArcTestnetConstants() public pure {
        assertEq(ArcTestnetConfig.CHAIN_ID, 5_042_002);
        assertEq(ArcTestnetConfig.USDC, 0x3600000000000000000000000000000000000000);
    }

    function testConstructorWiresInitialDeploymentConfiguration() public {
        MockERC20 usdc = new MockERC20(6);
        SettlementEscrow escrow = new SettlementEscrow(address(usdc), ADMIN, OPERATOR, ARBITRATOR, PAUSER);

        assertTrue(address(usdc) != ADMIN && ADMIN != OPERATOR && OPERATOR != ARBITRATOR && ARBITRATOR != PAUSER);
        assertEq(address(escrow.usdc()), address(usdc));
        assertTrue(escrow.hasRole(escrow.DEFAULT_ADMIN_ROLE(), ADMIN));
        assertTrue(escrow.hasRole(escrow.OPERATOR_ROLE(), OPERATOR));
        assertTrue(escrow.hasRole(escrow.ARBITRATOR_ROLE(), ARBITRATOR));
        assertTrue(escrow.hasRole(escrow.PAUSER_ROLE(), PAUSER));
        assertFalse(escrow.paused());
        assertEq(escrow.totalActiveEscrow(), 0);
    }

    function testProductionConstructorRejectsEveryZeroRoleInput() public {
        MockERC20 usdc = new MockERC20(6);

        _expectZeroRoleRevert(address(usdc), address(0), OPERATOR, ARBITRATOR, PAUSER);
        _expectZeroRoleRevert(address(usdc), ADMIN, address(0), ARBITRATOR, PAUSER);
        _expectZeroRoleRevert(address(usdc), ADMIN, OPERATOR, address(0), PAUSER);
        _expectZeroRoleRevert(address(usdc), ADMIN, OPERATOR, ARBITRATOR, address(0));
    }

    function _expectZeroRoleRevert(
        address usdc,
        address administrator,
        address operator,
        address arbitrator,
        address pauser
    ) private {
        vm.expectRevert(SettlementEscrow.ZeroAddress.selector);
        new SettlementEscrow(usdc, administrator, operator, arbitrator, pauser);
    }
}
