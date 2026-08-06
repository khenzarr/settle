// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Test} from "forge-std/Test.sol";
import {SettlementEscrow} from "../../src/SettlementEscrow.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {SettlementEscrowHandler} from "./SettlementEscrowHandler.sol";

contract SettlementEscrowInvariantTest is StdInvariant, Test {
    MockERC20 private token;
    SettlementEscrow private escrow;
    SettlementEscrowHandler private handler;

    function setUp() public {
        vm.warp(1_000_000);
        token = new MockERC20(6);
        escrow = new SettlementEscrow(address(token), address(this), address(this), address(this), address(this));
        handler = new SettlementEscrowHandler(token, escrow);
        escrow.grantRole(escrow.OPERATOR_ROLE(), address(handler));
        escrow.grantRole(escrow.ARBITRATOR_ROLE(), address(handler));
        escrow.grantRole(escrow.PAUSER_ROLE(), address(handler));
        targetContract(address(handler));
    }

    function invariantSolventAndAggregated() public view {
        assertGe(token.balanceOf(address(escrow)), escrow.totalActiveEscrow());
        assertEq(escrow.totalActiveEscrow(), handler.activeModel());
        uint256 obligations;
        for (uint256 i; i < handler.orderCount(); ++i) {
            SettlementEscrow.Order memory order = escrow.getOrder(handler.orderIds(i));
            if (
                order.status == SettlementEscrow.OrderStatus.Funded
                    || order.status == SettlementEscrow.OrderStatus.Disputed
            ) obligations += order.totalAmount;
        }
        assertEq(escrow.totalActiveEscrow(), obligations);
    }

    function invariantStatesAndTimestamps() public view {
        for (uint256 i; i < handler.orderCount(); ++i) {
            SettlementEscrow.Order memory order = escrow.getOrder(handler.orderIds(i));
            if (order.status == SettlementEscrow.OrderStatus.Created) {
                assertGt(order.createdAt, 0);
                assertEq(order.fundedAt, 0);
                assertEq(order.disputedAt, 0);
                assertEq(order.settledAt, 0);
                assertEq(order.refundedAt, 0);
                assertEq(order.cancelledAt, 0);
            } else if (order.status == SettlementEscrow.OrderStatus.Funded) {
                assertGt(order.fundedAt, 0);
                assertEq(order.disputedAt, 0);
                assertEq(order.settledAt, 0);
                assertEq(order.refundedAt, 0);
                assertEq(order.cancelledAt, 0);
            } else if (order.status == SettlementEscrow.OrderStatus.Disputed) {
                assertGt(order.fundedAt, 0);
                assertGt(order.disputedAt, 0);
                assertEq(order.settledAt, 0);
                assertEq(order.refundedAt, 0);
                assertEq(order.cancelledAt, 0);
            } else if (order.status == SettlementEscrow.OrderStatus.Completed) {
                assertGt(order.settledAt, 0);
                assertEq(order.refundedAt, 0);
                assertEq(order.cancelledAt, 0);
            } else if (order.status == SettlementEscrow.OrderStatus.Refunded) {
                assertGt(order.refundedAt, 0);
                assertEq(order.settledAt, 0);
                assertEq(order.cancelledAt, 0);
            } else if (order.status == SettlementEscrow.OrderStatus.Cancelled) {
                assertGt(order.cancelledAt, 0);
                assertEq(order.fundedAt, 0);
                assertEq(order.settledAt, 0);
                assertEq(order.refundedAt, 0);
            }
            assertEq(order.settlementDeadline > order.fundingDeadline, true);
        }
    }

    function invariantTerminalFinalityAndSinglePayout() public view {
        for (uint256 i; i < handler.orderCount(); ++i) {
            bytes32 id = handler.orderIds(i);
            SettlementEscrow.OrderStatus status = escrow.getOrder(id).status;
            if (status == SettlementEscrow.OrderStatus.Completed || status == SettlementEscrow.OrderStatus.Refunded) {
                assertTrue(handler.paid(id));
            }
            if (status == SettlementEscrow.OrderStatus.Created || status == SettlementEscrow.OrderStatus.Cancelled) {
                assertFalse(handler.funded(id));
            }
            assertLe(handler.fundingCount(id), 1);
            assertLe(handler.payoutCount(id), 1);
            SettlementEscrow.OrderStatus terminal = handler.terminalStatus(id);
            if (terminal != SettlementEscrow.OrderStatus.None) assertEq(uint256(status), uint256(terminal));
        }
    }

    function invariantTermsAndSplitsRemainValid() public view {
        for (uint256 i; i < handler.orderCount(); ++i) {
            bytes32 id = handler.orderIds(i);
            (address[] memory recipients, uint16[] memory shares) = escrow.getSettlementSplits(id);
            assertEq(recipients.length, 2);
            assertEq(shares.length, 2);
            assertEq(shares[0] + shares[1], 10_000);
            assertTrue(recipients[0] != address(0) && recipients[1] != address(0) && recipients[0] != recipients[1]);
            SettlementEscrow.Order memory order = escrow.getOrder(id);
            assertEq(order.buyer, address(uint160(0x100000 + i)));
            assertEq(order.totalAmount, handler.originalAmount(id));
            assertEq(order.fundingDeadline, order.createdAt + 100);
            assertEq(order.settlementDeadline, order.createdAt + 200);
            assertEq(order.termsHash, keccak256(abi.encode(id)));
            assertEq(recipients[0], address(uint160(0x200000 + i * 2)));
            assertEq(recipients[1], address(uint160(0x200001 + i * 2)));
        }
    }

    function invariantExactTerminalPayouts() public view {
        for (uint256 i; i < handler.orderCount(); ++i) {
            bytes32 id = handler.orderIds(i);
            SettlementEscrow.Order memory order = escrow.getOrder(id);
            if (order.status == SettlementEscrow.OrderStatus.Completed) {
                (address[] memory recipients,) = escrow.getSettlementSplits(id);
                assertEq(token.balanceOf(recipients[0]) + token.balanceOf(recipients[1]), order.totalAmount);
            } else if (order.status == SettlementEscrow.OrderStatus.Refunded) {
                assertEq(token.balanceOf(order.buyer), order.totalAmount);
            }
        }
    }

    function invariantPauseDoesNotChangeAccounting() public view {
        assertFalse(handler.pauseChangedAccounting());
        assertFalse(handler.pauseChangedOrders());
    }
}
