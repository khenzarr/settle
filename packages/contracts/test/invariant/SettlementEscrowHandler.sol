// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {SettlementEscrow} from "../../src/SettlementEscrow.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

contract SettlementEscrowHandler is Test {
    MockERC20 public immutable token;
    SettlementEscrow public immutable escrow;
    uint256 public constant MAX_ORDERS = 12;
    bytes32[] public orderIds;
    uint256 public activeModel;
    mapping(bytes32 => bool) public funded;
    mapping(bytes32 => bool) public paid;
    mapping(bytes32 => uint256) public fundingCount;
    mapping(bytes32 => uint256) public payoutCount;
    mapping(bytes32 => uint256) public originalAmount;
    mapping(bytes32 => SettlementEscrow.OrderStatus) public terminalStatus;
    bool public pauseChangedAccounting;
    bool public pauseChangedOrders;

    constructor(MockERC20 token_, SettlementEscrow escrow_) {
        token = token_;
        escrow = escrow_;
    }

    function create(uint256 rawAmount, uint256 rawId) external {
        if (orderIds.length == MAX_ORDERS || escrow.paused()) return;
        bytes32 id = keccak256(abi.encode("invariant-order", orderIds.length, rawId));
        if (escrow.orderExists(id)) return;
        uint256 amount = bound(rawAmount, 1, 10_000_000_000);
        address buyer = address(uint160(0x100000 + orderIds.length));
        address[] memory recipients = new address[](2);
        recipients[0] = address(uint160(0x200000 + orderIds.length * 2));
        recipients[1] = address(uint160(0x200001 + orderIds.length * 2));
        uint16[] memory shares = new uint16[](2);
        shares[0] = 6000;
        shares[1] = 4000;
        escrow.createOrder(
            id,
            buyer,
            amount,
            block.timestamp + 100,
            block.timestamp + 200,
            keccak256(abi.encode(id)),
            recipients,
            shares
        );
        orderIds.push(id);
        originalAmount[id] = amount;
    }

    function fund(uint256 rawIndex) external {
        if (orderIds.length == 0 || escrow.paused()) return;
        bytes32 id = orderIds[rawIndex % orderIds.length];
        SettlementEscrow.Order memory order = escrow.getOrder(id);
        if (order.status != SettlementEscrow.OrderStatus.Created || block.timestamp >= order.fundingDeadline) return;
        token.mint(order.buyer, order.totalAmount);
        vm.prank(order.buyer);
        token.approve(address(escrow), order.totalAmount);
        vm.prank(order.buyer);
        escrow.fundOrder(id);
        funded[id] = true;
        fundingCount[id] += 1;
        activeModel += order.totalAmount;
    }

    function dispute(uint256 rawIndex) external {
        if (orderIds.length == 0 || escrow.paused()) return;
        bytes32 id = orderIds[rawIndex % orderIds.length];
        SettlementEscrow.Order memory order = escrow.getOrder(id);
        if (order.status != SettlementEscrow.OrderStatus.Funded) return;
        vm.prank(order.buyer);
        escrow.raiseDispute(id);
    }

    function release(uint256 rawIndex) external {
        if (orderIds.length == 0 || escrow.paused()) return;
        bytes32 id = orderIds[rawIndex % orderIds.length];
        SettlementEscrow.Order memory order = escrow.getOrder(id);
        if (order.status != SettlementEscrow.OrderStatus.Funded) return;
        vm.prank(order.buyer);
        escrow.releaseOrder(id);
        paid[id] = true;
        payoutCount[id] += 1;
        terminalStatus[id] = SettlementEscrow.OrderStatus.Completed;
        activeModel -= order.totalAmount;
    }

    function refund(uint256 rawIndex) external {
        if (orderIds.length == 0 || escrow.paused()) return;
        bytes32 id = orderIds[rawIndex % orderIds.length];
        SettlementEscrow.Order memory order = escrow.getOrder(id);
        if (order.status != SettlementEscrow.OrderStatus.Funded) return;
        escrow.refundOrder(id);
        paid[id] = true;
        payoutCount[id] += 1;
        terminalStatus[id] = SettlementEscrow.OrderStatus.Refunded;
        activeModel -= order.totalAmount;
    }

    function resolve(uint256 rawIndex, bool releaseResolution) external {
        if (orderIds.length == 0 || escrow.paused()) return;
        bytes32 id = orderIds[rawIndex % orderIds.length];
        SettlementEscrow.Order memory order = escrow.getOrder(id);
        if (order.status != SettlementEscrow.OrderStatus.Disputed) return;
        escrow.resolveDispute(
            id,
            releaseResolution ? SettlementEscrow.DisputeResolution.Release : SettlementEscrow.DisputeResolution.Refund
        );
        paid[id] = true;
        payoutCount[id] += 1;
        terminalStatus[id] =
            releaseResolution ? SettlementEscrow.OrderStatus.Completed : SettlementEscrow.OrderStatus.Refunded;
        activeModel -= order.totalAmount;
    }

    function cancel(uint256 rawIndex) external {
        if (orderIds.length == 0 || escrow.paused()) return;
        bytes32 id = orderIds[rawIndex % orderIds.length];
        SettlementEscrow.Order memory order = escrow.getOrder(id);
        if (order.status != SettlementEscrow.OrderStatus.Created || block.timestamp < order.fundingDeadline) return;
        escrow.cancelExpiredOrder(id);
        terminalStatus[id] = SettlementEscrow.OrderStatus.Cancelled;
    }

    function retryFunding(uint256 rawIndex) external {
        if (orderIds.length == 0 || escrow.paused()) return;
        bytes32 id = orderIds[rawIndex % orderIds.length];
        SettlementEscrow.Order memory order = escrow.getOrder(id);
        if (order.status == SettlementEscrow.OrderStatus.Created) return;
        vm.prank(order.buyer);
        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.InvalidOrderStatus.selector, order.status));
        escrow.fundOrder(id);
    }

    function retryTerminalTransition(uint256 rawIndex, uint8 rawAction) external {
        if (orderIds.length == 0 || escrow.paused()) return;
        bytes32 id = orderIds[rawIndex % orderIds.length];
        SettlementEscrow.Order memory order = escrow.getOrder(id);
        if (
            order.status != SettlementEscrow.OrderStatus.Completed
                && order.status != SettlementEscrow.OrderStatus.Refunded
                && order.status != SettlementEscrow.OrderStatus.Cancelled
        ) return;

        bytes memory expected = abi.encodeWithSelector(SettlementEscrow.InvalidOrderStatus.selector, order.status);
        uint8 action = rawAction % 5;
        if (action == 0) {
            vm.prank(order.buyer);
            vm.expectRevert(expected);
            escrow.releaseOrder(id);
        } else if (action == 1) {
            vm.expectRevert(expected);
            escrow.refundOrder(id);
        } else if (action == 2) {
            vm.prank(order.buyer);
            vm.expectRevert(expected);
            escrow.raiseDispute(id);
        } else if (action == 3) {
            vm.expectRevert(expected);
            escrow.resolveDispute(id, SettlementEscrow.DisputeResolution.Release);
        } else {
            vm.expectRevert(expected);
            escrow.cancelExpiredOrder(id);
        }
    }

    function warp(uint256 rawTime) external {
        vm.warp(block.timestamp + bound(rawTime, 0, 250));
    }

    function togglePause() external {
        uint256 balanceBefore = token.balanceOf(address(escrow));
        uint256 activeBefore = escrow.totalActiveEscrow();
        bytes32 ordersBefore = _ordersDigest();
        if (escrow.paused()) escrow.unpause();
        else escrow.pause();
        pauseChangedAccounting = pauseChangedAccounting || balanceBefore != token.balanceOf(address(escrow))
            || activeBefore != escrow.totalActiveEscrow();
        pauseChangedOrders = pauseChangedOrders || ordersBefore != _ordersDigest();
    }

    function orderCount() external view returns (uint256) {
        return orderIds.length;
    }

    function _ordersDigest() private view returns (bytes32 digest) {
        for (uint256 i; i < orderIds.length; ++i) {
            bytes32 id = orderIds[i];
            SettlementEscrow.Order memory order = escrow.getOrder(id);
            (address[] memory recipients, uint16[] memory shares) = escrow.getSettlementSplits(id);
            digest = keccak256(abi.encode(digest, id, order, recipients, shares));
        }
    }
}
