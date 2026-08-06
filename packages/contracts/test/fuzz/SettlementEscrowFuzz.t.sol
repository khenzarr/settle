// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {SettlementEscrow} from "../../src/SettlementEscrow.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

contract SettlementEscrowFuzzTest is Test {
    address private constant OPERATOR = address(0xBEEF);
    address private constant ARBITRATOR = address(0xA4B1);
    address private constant PAUSER = address(0xA55E);
    address private constant BUYER = address(0xB0B);
    bytes32 private constant TERMS = keccak256("fuzz-terms");
    uint256 private constant MIN_AMOUNT = 1;
    uint256 private constant MAX_AMOUNT = 10_000_000_000;

    MockERC20 private token;
    SettlementEscrow private escrow;

    function setUp() public {
        vm.warp(1_000_000);
        token = new MockERC20(6);
        escrow = new SettlementEscrow(address(token), address(this), OPERATOR, ARBITRATOR, PAUSER);
    }

    function testFuzzAmountFundingReleaseRefund(uint256 rawAmount, bool refund) public {
        uint256 amount = bound(rawAmount, MIN_AMOUNT, MAX_AMOUNT);
        bytes32 orderId = keccak256(abi.encode("amount", rawAmount, refund));
        _create(orderId, amount, _twoRecipients(), _twoShares());
        token.mint(BUYER, amount);
        vm.prank(BUYER);
        token.approve(address(escrow), amount);
        vm.prank(BUYER);
        escrow.fundOrder(orderId);
        assertEq(token.balanceOf(address(escrow)), amount);
        assertEq(escrow.totalActiveEscrow(), amount);

        if (refund) {
            uint256 beforeBalance = token.balanceOf(BUYER);
            vm.prank(OPERATOR);
            escrow.refundOrder(orderId);
            assertEq(token.balanceOf(BUYER) - beforeBalance, amount);
        } else {
            address[] memory recipients = _twoRecipients();
            uint256 beforeOne = token.balanceOf(recipients[0]);
            uint256 beforeTwo = token.balanceOf(recipients[1]);
            vm.prank(BUYER);
            escrow.releaseOrder(orderId);
            assertEq(
                (token.balanceOf(recipients[0]) - beforeOne) + (token.balanceOf(recipients[1]) - beforeTwo), amount
            );
        }
        assertEq(token.balanceOf(address(escrow)), 0);
        assertEq(escrow.totalActiveEscrow(), 0);
    }

    function testFuzzValidSettlementSplits(uint256 rawAmount, uint8 rawCount, uint256 seed) public {
        uint256 amount = bound(rawAmount, MIN_AMOUNT, MAX_AMOUNT);
        uint256 count = bound(uint256(rawCount), 1, 8);
        (address[] memory recipients, uint16[] memory shares) = _splits(count, seed);
        bytes32 orderId = keccak256(abi.encode("split", rawAmount, rawCount, seed));
        _create(orderId, amount, recipients, shares);
        token.mint(BUYER, amount);
        vm.prank(BUYER);
        token.approve(address(escrow), amount);
        vm.prank(BUYER);
        escrow.fundOrder(orderId);
        uint256[] memory beforeBalances = new uint256[](count);
        for (uint256 i; i < count; ++i) {
            beforeBalances[i] = token.balanceOf(recipients[i]);
        }
        vm.prank(BUYER);
        escrow.releaseOrder(orderId);
        uint256 distributed;
        for (uint256 i; i < count; ++i) {
            uint256 paid = token.balanceOf(recipients[i]) - beforeBalances[i];
            assertLe(paid, amount);
            uint256 expected = i == count - 1 ? amount - distributed : amount * shares[i] / 10_000;
            assertEq(paid, expected);
            distributed += paid;
        }
        assertEq(distributed, amount);
    }

    function testFuzzInvalidSettlementSplits(uint8 rawKind, uint8 rawIndex) public {
        (address[] memory recipients, uint16[] memory shares) = _twoRecipientsAndShares();
        uint256 index = bound(uint256(rawIndex), 0, 1);
        uint8 kind = uint8(bound(uint256(rawKind), 0, 4));
        if (kind == 0) shares[index] = 0;
        if (kind == 1) recipients[index] = address(0);
        if (kind == 2) recipients[1] = recipients[0];
        if (kind == 3) shares[1] -= 1;
        if (kind == 4) shares[1] += 1;
        vm.prank(OPERATOR);
        vm.expectRevert();
        escrow.createOrder(
            bytes32("invalid"), BUYER, 1, block.timestamp + 1, block.timestamp + 2, TERMS, recipients, shares
        );
    }

    function testFuzzDeadlineBoundaries(uint256 rawOffset, bool fund) public {
        uint256 fundingDeadline = block.timestamp + 100;
        bytes32 orderId = keccak256(abi.encode("deadline", rawOffset, fund));
        _create(orderId, 100, _twoRecipients(), _twoShares(), fundingDeadline, fundingDeadline + 1);
        uint256 timestamp = fundingDeadline + bound(rawOffset, 0, 1);
        vm.warp(timestamp);
        if (fund) {
            token.mint(BUYER, 100);
            vm.prank(BUYER);
            token.approve(address(escrow), 100);
            vm.prank(BUYER);
            vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.FundingDeadlinePassed.selector, fundingDeadline));
            escrow.fundOrder(orderId);
        } else {
            escrow.cancelExpiredOrder(orderId);
            assertEq(uint256(escrow.getOrder(orderId).status), uint256(SettlementEscrow.OrderStatus.Cancelled));
        }
    }

    function testFuzzFundingBeforeDeadline(uint256 rawOffset) public {
        uint256 deadline = block.timestamp + 2;
        bytes32 id = keccak256(abi.encode("before", rawOffset));
        _create(id, 7, _twoRecipients(), _twoShares(), deadline, deadline + 1);
        vm.warp(deadline - 1);
        token.mint(BUYER, 7);
        vm.prank(BUYER);
        token.approve(address(escrow), 7);
        vm.prank(BUYER);
        escrow.fundOrder(id);
        assertEq(uint256(escrow.getOrder(id).status), uint256(SettlementEscrow.OrderStatus.Funded));
    }

    function testFuzzCancellationBeforeDeadlineFails(uint256 rawOffset) public {
        uint256 deadline = block.timestamp + bound(rawOffset, 2, 30 days);
        bytes32 id = keccak256(abi.encode("cancel-before", rawOffset));
        _create(id, 7, _twoRecipients(), _twoShares(), deadline, deadline + 1);
        vm.warp(deadline - 1);
        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.FundingDeadlineNotReached.selector, deadline));
        escrow.cancelExpiredOrder(id);
    }

    function testFuzzSettlementDeadlineMustFollowFundingDeadline(uint256 rawOffset, bool equal) public {
        uint256 fundingDeadline = block.timestamp + bound(rawOffset, 1, 30 days);
        uint256 settlementDeadline = equal ? fundingDeadline : fundingDeadline - 1;
        vm.prank(OPERATOR);
        vm.expectRevert(SettlementEscrow.InvalidSettlementDeadline.selector);
        escrow.createOrder(
            keccak256(abi.encode("deadline-ordering", rawOffset, equal)),
            BUYER,
            1,
            fundingDeadline,
            settlementDeadline,
            TERMS,
            _twoRecipients(),
            _twoShares()
        );
    }

    function testLifecyclePathsAreTerminal(uint8 rawPath) public {
        uint8 path = uint8(bound(uint256(rawPath), 0, 4));
        bytes32 id = keccak256(abi.encode("path", rawPath));
        _create(id, 101, _twoRecipients(), _twoShares());
        if (path == 4) {
            vm.warp(block.timestamp + 2 days);
            escrow.cancelExpiredOrder(id);
            vm.expectRevert();
            escrow.cancelExpiredOrder(id);
            return;
        }
        token.mint(BUYER, 101);
        vm.prank(BUYER);
        token.approve(address(escrow), 101);
        vm.prank(BUYER);
        escrow.fundOrder(id);
        if (path >= 2) {
            vm.prank(BUYER);
            escrow.raiseDispute(id);
            vm.prank(ARBITRATOR);
            escrow.resolveDispute(
                id, path == 2 ? SettlementEscrow.DisputeResolution.Release : SettlementEscrow.DisputeResolution.Refund
            );
        } else if (path == 0) {
            vm.prank(BUYER);
            escrow.releaseOrder(id);
        } else {
            vm.prank(OPERATOR);
            escrow.refundOrder(id);
        }
        SettlementEscrow.OrderStatus status = escrow.getOrder(id).status;
        assertTrue(status == SettlementEscrow.OrderStatus.Completed || status == SettlementEscrow.OrderStatus.Refunded);
        vm.prank(BUYER);
        vm.expectRevert();
        escrow.raiseDispute(id);
        vm.prank(BUYER);
        vm.expectRevert();
        escrow.releaseOrder(id);
        vm.prank(OPERATOR);
        vm.expectRevert();
        escrow.refundOrder(id);
        vm.expectRevert();
        escrow.cancelExpiredOrder(id);
    }

    function _create(bytes32 id, uint256 amount, address[] memory recipients, uint16[] memory shares) private {
        _create(id, amount, recipients, shares, block.timestamp + 1 days, block.timestamp + 2 days);
    }

    function _create(
        bytes32 id,
        uint256 amount,
        address[] memory recipients,
        uint16[] memory shares,
        uint256 fundingDeadline,
        uint256 settlementDeadline
    ) private {
        vm.prank(OPERATOR);
        escrow.createOrder(id, BUYER, amount, fundingDeadline, settlementDeadline, TERMS, recipients, shares);
    }

    function _splits(uint256 count, uint256 seed)
        private
        pure
        returns (address[] memory recipients, uint16[] memory shares)
    {
        recipients = new address[](count);
        shares = new uint16[](count);
        uint256 remaining = 10_000;
        for (uint256 i; i < count; ++i) {
            recipients[i] = address(uint160(0x1000 + i));
            if (i == count - 1) {
                shares[i] = uint16(remaining);
            } else {
                uint256 share = 1 + uint256(keccak256(abi.encode(seed, i))) % (remaining - (count - i - 1));
                shares[i] = uint16(share);
                remaining -= share;
            }
        }
    }

    function _twoRecipients() private pure returns (address[] memory r) {
        r = new address[](2);
        r[0] = address(0x1111);
        r[1] = address(0x2222);
    }

    function _twoShares() private pure returns (uint16[] memory s) {
        s = new uint16[](2);
        s[0] = 6000;
        s[1] = 4000;
    }

    function _twoRecipientsAndShares() private pure returns (address[] memory r, uint16[] memory s) {
        r = _twoRecipients();
        s = _twoShares();
    }
}
