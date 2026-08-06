// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Test} from "forge-std/Test.sol";

import {SettlementEscrow} from "../src/SettlementEscrow.sol";
import {FailingTransferERC20} from "./mocks/FailingTransferERC20.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract SettlementEscrowTest is Test {
    event OrderCreated(
        bytes32 indexed orderId,
        address indexed buyer,
        uint256 totalAmount,
        uint256 fundingDeadline,
        uint256 settlementDeadline,
        bytes32 termsHash
    );

    event OrderFunded(bytes32 indexed orderId, address indexed buyer, uint256 fundedAmount, uint256 fundedAt);

    event OrderDisputed(bytes32 indexed orderId, address indexed caller, address indexed buyer, uint256 disputedAt);

    event OrderReleased(bytes32 indexed orderId, address indexed buyer, uint256 totalAmount, uint256 settledAt);

    event OrderRefunded(bytes32 indexed orderId, address indexed buyer, uint256 refundedAmount, uint256 refundedAt);

    event OrderCancelled(bytes32 indexed orderId, address indexed caller, address indexed buyer, uint256 cancelledAt);

    event SettlementPaid(bytes32 indexed orderId, address indexed recipient, uint256 recipientAmount);

    event DisputeResolved(
        bytes32 indexed orderId,
        address indexed arbitrator,
        SettlementEscrow.DisputeResolution resolution,
        uint256 amount,
        uint256 resolvedAt
    );

    event Paused(address account);
    event Unpaused(address account);

    address private constant ADMIN = address(0xA11CE);
    address private constant OPERATOR = address(0x0B0B0B);
    address private constant ARBITRATOR = address(0xA4B1);
    address private constant PAUSER = address(0xA55E);
    address private constant BUYER = address(0xB0B);
    address private constant RECIPIENT_ONE = address(0x1111);
    address private constant RECIPIENT_TWO = address(0x2222);
    address private constant UNAUTHORIZED = address(0xBAD);

    bytes32 private constant ORDER_ID = keccak256("order-1");
    bytes32 private constant TERMS_HASH = keccak256("terms-1");
    uint256 private constant TOTAL_AMOUNT = 125_000_000;

    MockERC20 private usdc;
    SettlementEscrow private escrow;
    uint256 private fundingDeadline;
    uint256 private settlementDeadline;

    struct BalanceSnapshot {
        uint256 totalActiveEscrow;
        uint256 escrowBalance;
        uint256 buyerBalance;
        uint256 recipientOneBalance;
        uint256 recipientTwoBalance;
    }

    function setUp() public {
        vm.warp(1_000_000);
        usdc = new MockERC20(6);
        escrow = new SettlementEscrow(address(usdc), ADMIN, OPERATOR, ARBITRATOR, PAUSER);
        fundingDeadline = block.timestamp + 1 days;
        settlementDeadline = fundingDeadline + 7 days;
    }

    function testSuccessfulDeployment() public view {
        assertGt(address(escrow).code.length, 0);
        assertEq(address(escrow.usdc()), address(usdc));
    }

    function testRejectsTokenWithoutSixDecimals() public {
        MockERC20 invalidToken = new MockERC20(18);

        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.InvalidTokenDecimals.selector, 18));
        new SettlementEscrow(address(invalidToken), ADMIN, OPERATOR, ARBITRATOR, PAUSER);
    }

    function testRejectsZeroTokenAddress() public {
        vm.expectRevert(SettlementEscrow.ZeroAddress.selector);
        new SettlementEscrow(address(0), ADMIN, OPERATOR, ARBITRATOR, PAUSER);
    }

    function testRejectsZeroAdministratorAddress() public {
        vm.expectRevert(SettlementEscrow.ZeroAddress.selector);
        new SettlementEscrow(address(usdc), address(0), OPERATOR, ARBITRATOR, PAUSER);
    }

    function testRejectsZeroOperatorAddress() public {
        vm.expectRevert(SettlementEscrow.ZeroAddress.selector);
        new SettlementEscrow(address(usdc), ADMIN, address(0), ARBITRATOR, PAUSER);
    }

    function testRejectsZeroArbitratorAddress() public {
        vm.expectRevert(SettlementEscrow.ZeroAddress.selector);
        new SettlementEscrow(address(usdc), ADMIN, OPERATOR, address(0), PAUSER);
    }

    function testRejectsZeroPauserAddress() public {
        vm.expectRevert(SettlementEscrow.ZeroAddress.selector);
        new SettlementEscrow(address(usdc), ADMIN, OPERATOR, ARBITRATOR, address(0));
    }

    function testAssignsDistinctRoles() public view {
        assertTrue(escrow.hasRole(escrow.DEFAULT_ADMIN_ROLE(), ADMIN));
        assertTrue(escrow.hasRole(escrow.OPERATOR_ROLE(), OPERATOR));
        assertTrue(escrow.hasRole(escrow.ARBITRATOR_ROLE(), ARBITRATOR));
        assertTrue(escrow.hasRole(escrow.PAUSER_ROLE(), PAUSER));
        assertFalse(escrow.hasRole(escrow.OPERATOR_ROLE(), ADMIN));
        assertFalse(escrow.hasRole(escrow.DEFAULT_ADMIN_ROLE(), OPERATOR));
        assertFalse(escrow.hasRole(escrow.ARBITRATOR_ROLE(), ADMIN));
        assertFalse(escrow.hasRole(escrow.ARBITRATOR_ROLE(), OPERATOR));
        assertFalse(escrow.hasRole(escrow.OPERATOR_ROLE(), ARBITRATOR));
        assertFalse(escrow.hasRole(escrow.DEFAULT_ADMIN_ROLE(), ARBITRATOR));
        assertFalse(escrow.hasRole(escrow.PAUSER_ROLE(), ADMIN));
        assertFalse(escrow.hasRole(escrow.PAUSER_ROLE(), OPERATOR));
        assertFalse(escrow.hasRole(escrow.PAUSER_ROLE(), ARBITRATOR));
        assertFalse(escrow.hasRole(escrow.DEFAULT_ADMIN_ROLE(), PAUSER));
        assertFalse(escrow.hasRole(escrow.OPERATOR_ROLE(), PAUSER));
        assertFalse(escrow.hasRole(escrow.ARBITRATOR_ROLE(), PAUSER));
    }

    function testAllowsSameAddressForBothRoles() public {
        SettlementEscrow sharedRoleEscrow = new SettlementEscrow(address(usdc), ADMIN, ADMIN, ADMIN, ADMIN);

        assertTrue(sharedRoleEscrow.hasRole(sharedRoleEscrow.DEFAULT_ADMIN_ROLE(), ADMIN));
        assertTrue(sharedRoleEscrow.hasRole(sharedRoleEscrow.OPERATOR_ROLE(), ADMIN));
        assertTrue(sharedRoleEscrow.hasRole(sharedRoleEscrow.ARBITRATOR_ROLE(), ADMIN));
        assertTrue(sharedRoleEscrow.hasRole(sharedRoleEscrow.PAUSER_ROLE(), ADMIN));
    }

    function testCreatesOrder() public {
        _createDefaultOrder();

        assertTrue(escrow.orderExists(ORDER_ID));
    }

    function testRejectsUnauthorizedOrderCreation() public {
        (address[] memory recipients, uint16[] memory shares) = _defaultSplits();
        bytes32 operatorRole = escrow.OPERATOR_ROLE();

        vm.prank(UNAUTHORIZED);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, UNAUTHORIZED, operatorRole)
        );
        escrow.createOrder(
            ORDER_ID, BUYER, TOTAL_AMOUNT, fundingDeadline, settlementDeadline, TERMS_HASH, recipients, shares
        );
    }

    function testRejectsZeroOrderId() public {
        _expectCreateRevert(
            SettlementEscrow.ZeroOrderId.selector,
            bytes32(0),
            BUYER,
            TOTAL_AMOUNT,
            fundingDeadline,
            settlementDeadline,
            TERMS_HASH
        );
    }

    function testRejectsDuplicateOrderId() public {
        _createDefaultOrder();

        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.OrderAlreadyExists.selector, ORDER_ID));
        _createDefaultOrder();
    }

    function testRejectsZeroBuyer() public {
        _expectCreateRevert(
            SettlementEscrow.ZeroBuyer.selector,
            ORDER_ID,
            address(0),
            TOTAL_AMOUNT,
            fundingDeadline,
            settlementDeadline,
            TERMS_HASH
        );
    }

    function testRejectsZeroAmount() public {
        _expectCreateRevert(
            SettlementEscrow.ZeroAmount.selector, ORDER_ID, BUYER, 0, fundingDeadline, settlementDeadline, TERMS_HASH
        );
    }

    function testRejectsFundingDeadlineAtCurrentTimestamp() public {
        _expectCreateRevert(
            SettlementEscrow.InvalidFundingDeadline.selector,
            ORDER_ID,
            BUYER,
            TOTAL_AMOUNT,
            block.timestamp,
            settlementDeadline,
            TERMS_HASH
        );
    }

    function testRejectsFundingDeadlineInPast() public {
        _expectCreateRevert(
            SettlementEscrow.InvalidFundingDeadline.selector,
            ORDER_ID,
            BUYER,
            TOTAL_AMOUNT,
            block.timestamp - 1,
            settlementDeadline,
            TERMS_HASH
        );
    }

    function testRejectsSettlementDeadlineAtFundingDeadline() public {
        _expectCreateRevert(
            SettlementEscrow.InvalidSettlementDeadline.selector,
            ORDER_ID,
            BUYER,
            TOTAL_AMOUNT,
            fundingDeadline,
            fundingDeadline,
            TERMS_HASH
        );
    }

    function testRejectsSettlementDeadlineBeforeFundingDeadline() public {
        _expectCreateRevert(
            SettlementEscrow.InvalidSettlementDeadline.selector,
            ORDER_ID,
            BUYER,
            TOTAL_AMOUNT,
            fundingDeadline,
            fundingDeadline - 1,
            TERMS_HASH
        );
    }

    function testRejectsZeroTermsHash() public {
        _expectCreateRevert(
            SettlementEscrow.ZeroTermsHash.selector,
            ORDER_ID,
            BUYER,
            TOTAL_AMOUNT,
            fundingDeadline,
            settlementDeadline,
            bytes32(0)
        );
    }

    function testRejectsNoRecipients() public {
        address[] memory recipients = new address[](0);
        uint16[] memory shares = new uint16[](0);

        vm.prank(OPERATOR);
        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.InvalidRecipientCount.selector, 0));
        _createOrder(recipients, shares);
    }

    function testRejectsMoreThanEightRecipients() public {
        address[] memory recipients = new address[](9);
        uint16[] memory shares = new uint16[](9);
        for (uint256 i = 0; i < 9; ++i) {
            recipients[i] = address(uint160(i + 1));
            shares[i] = 1_000;
        }

        vm.prank(OPERATOR);
        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.InvalidRecipientCount.selector, 9));
        _createOrder(recipients, shares);
    }

    function testRejectsZeroRecipient() public {
        (address[] memory recipients, uint16[] memory shares) = _defaultSplits();
        recipients[1] = address(0);

        vm.prank(OPERATOR);
        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.ZeroRecipient.selector, 1));
        _createOrder(recipients, shares);
    }

    function testRejectsDuplicateRecipient() public {
        (address[] memory recipients, uint16[] memory shares) = _defaultSplits();
        recipients[1] = recipients[0];

        vm.prank(OPERATOR);
        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.DuplicateRecipient.selector, RECIPIENT_ONE));
        _createOrder(recipients, shares);
    }

    function testRejectsZeroShare() public {
        (address[] memory recipients, uint16[] memory shares) = _defaultSplits();
        shares[1] = 0;

        vm.prank(OPERATOR);
        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.ZeroShare.selector, 1));
        _createOrder(recipients, shares);
    }

    function testRejectsSharesBelowTenThousand() public {
        (address[] memory recipients, uint16[] memory shares) = _defaultSplits();
        shares[1] = 3_999;

        vm.prank(OPERATOR);
        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.InvalidTotalShares.selector, 9_999));
        _createOrder(recipients, shares);
    }

    function testRejectsSharesAboveTenThousand() public {
        (address[] memory recipients, uint16[] memory shares) = _defaultSplits();
        shares[1] = 4_001;

        vm.prank(OPERATOR);
        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.InvalidTotalShares.selector, 10_001));
        _createOrder(recipients, shares);
    }

    function testRejectsSettlementArrayLengthMismatch() public {
        (address[] memory recipients,) = _defaultSplits();
        uint16[] memory shares = new uint16[](1);
        shares[0] = 10_000;

        vm.prank(OPERATOR);
        vm.expectRevert(SettlementEscrow.SettlementArrayLengthMismatch.selector);
        _createOrder(recipients, shares);
    }

    function testStoresCompleteOrderData() public {
        uint256 expectedCreatedAt = block.timestamp;
        _createDefaultOrder();

        SettlementEscrow.Order memory order = escrow.getOrder(ORDER_ID);
        assertEq(order.buyer, BUYER);
        assertEq(order.totalAmount, TOTAL_AMOUNT);
        assertEq(order.fundingDeadline, fundingDeadline);
        assertEq(order.settlementDeadline, settlementDeadline);
        assertEq(order.termsHash, TERMS_HASH);
        assertEq(order.createdAt, expectedCreatedAt);
        assertEq(order.fundedAt, 0);
        assertEq(order.disputedAt, 0);
        assertEq(order.settledAt, 0);
        assertEq(order.refundedAt, 0);
        assertEq(order.cancelledAt, 0);
        assertEq(uint256(order.status), uint256(SettlementEscrow.OrderStatus.Created));
    }

    function testStoresSettlementSplits() public {
        _createDefaultOrder();

        (address[] memory recipients, uint16[] memory shares) = escrow.getSettlementSplits(ORDER_ID);
        assertEq(recipients.length, 2);
        assertEq(shares.length, 2);
        assertEq(recipients[0], RECIPIENT_ONE);
        assertEq(recipients[1], RECIPIENT_TWO);
        assertEq(shares[0], 6_000);
        assertEq(shares[1], 4_000);
    }

    function testEmitsOrderCreatedEvent() public {
        vm.expectEmit(true, true, false, true, address(escrow));
        emit OrderCreated(ORDER_ID, BUYER, TOTAL_AMOUNT, fundingDeadline, settlementDeadline, TERMS_HASH);

        _createDefaultOrder();
    }

    function testOrderExistsReturnsFalseForUnknownOrder() public view {
        assertFalse(escrow.orderExists(ORDER_ID));
    }

    function testGetOrderRejectsUnknownOrder() public {
        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.OrderNotFound.selector, ORDER_ID));
        escrow.getOrder(ORDER_ID);
    }

    function testGetSettlementSplitsRejectsUnknownOrder() public {
        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.OrderNotFound.selector, ORDER_ID));
        escrow.getSettlementSplits(ORDER_ID);
    }

    function testFundsOrderSuccessfully() public {
        _createDefaultOrder();
        _prepareBuyerFunding(TOTAL_AMOUNT, TOTAL_AMOUNT);

        vm.prank(BUYER);
        escrow.fundOrder(ORDER_ID);

        assertEq(uint256(escrow.getOrder(ORDER_ID).status), uint256(SettlementEscrow.OrderStatus.Funded));
    }

    function testStoresFundingTimestamp() public {
        _createDefaultOrder();
        _prepareBuyerFunding(TOTAL_AMOUNT, TOTAL_AMOUNT);
        uint256 expectedFundedAt = block.timestamp;

        vm.prank(BUYER);
        escrow.fundOrder(ORDER_ID);

        assertEq(escrow.getOrder(ORDER_ID).fundedAt, expectedFundedAt);
    }

    function testTransfersExactUsdcAmount() public {
        _createDefaultOrder();
        uint256 initialBuyerBalance = TOTAL_AMOUNT + 25_000_000;
        _prepareBuyerFunding(initialBuyerBalance, TOTAL_AMOUNT);

        vm.prank(BUYER);
        escrow.fundOrder(ORDER_ID);

        assertEq(usdc.balanceOf(address(escrow)), TOTAL_AMOUNT);
        assertEq(usdc.balanceOf(BUYER), initialBuyerBalance - TOTAL_AMOUNT);
    }

    function testIncreasesTotalActiveEscrow() public {
        _createDefaultOrder();
        _prepareBuyerFunding(TOTAL_AMOUNT, TOTAL_AMOUNT);

        vm.prank(BUYER);
        escrow.fundOrder(ORDER_ID);

        assertEq(escrow.totalActiveEscrow(), TOTAL_AMOUNT);
    }

    function testEmitsOrderFundedEvent() public {
        _createDefaultOrder();
        _prepareBuyerFunding(TOTAL_AMOUNT, TOTAL_AMOUNT);
        uint256 expectedFundedAt = block.timestamp;

        vm.expectEmit(true, true, false, true, address(escrow));
        emit OrderFunded(ORDER_ID, BUYER, TOTAL_AMOUNT, expectedFundedAt);

        vm.prank(BUYER);
        escrow.fundOrder(ORDER_ID);
    }

    function testFundingRejectsUnknownOrder() public {
        vm.prank(BUYER);
        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.OrderNotFound.selector, ORDER_ID));
        escrow.fundOrder(ORDER_ID);
    }

    function testFundingRejectsCallerWhoIsNotBuyer() public {
        _createDefaultOrder();

        vm.prank(UNAUTHORIZED);
        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.CallerNotBuyer.selector, UNAUTHORIZED));
        escrow.fundOrder(ORDER_ID);
    }

    function testFundingRejectsAtFundingDeadline() public {
        _createDefaultOrder();
        _prepareBuyerFunding(TOTAL_AMOUNT, TOTAL_AMOUNT);
        vm.warp(fundingDeadline);

        vm.prank(BUYER);
        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.FundingDeadlinePassed.selector, fundingDeadline));
        escrow.fundOrder(ORDER_ID);
    }

    function testFundingRejectsAfterFundingDeadline() public {
        _createDefaultOrder();
        _prepareBuyerFunding(TOTAL_AMOUNT, TOTAL_AMOUNT);
        vm.warp(fundingDeadline + 1);

        vm.prank(BUYER);
        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.FundingDeadlinePassed.selector, fundingDeadline));
        escrow.fundOrder(ORDER_ID);
    }

    function testFundingRejectsDuplicateFunding() public {
        _createDefaultOrder();
        _prepareBuyerFunding(TOTAL_AMOUNT * 2, TOTAL_AMOUNT * 2);

        vm.startPrank(BUYER);
        escrow.fundOrder(ORDER_ID);
        vm.expectRevert(
            abi.encodeWithSelector(SettlementEscrow.InvalidOrderStatus.selector, SettlementEscrow.OrderStatus.Funded)
        );
        escrow.fundOrder(ORDER_ID);
        vm.stopPrank();
    }

    function testFundingRejectsInsufficientTokenBalance() public {
        _createDefaultOrder();
        _prepareBuyerFunding(TOTAL_AMOUNT - 1, TOTAL_AMOUNT);

        vm.prank(BUYER);
        vm.expectRevert();
        escrow.fundOrder(ORDER_ID);
    }

    function testFundingRejectsInsufficientAllowance() public {
        _createDefaultOrder();
        _prepareBuyerFunding(TOTAL_AMOUNT, TOTAL_AMOUNT - 1);

        vm.prank(BUYER);
        vm.expectRevert();
        escrow.fundOrder(ORDER_ID);
    }

    function testBuyerCanCancelAfterFundingDeadline() public {
        _createDefaultOrder();
        vm.warp(fundingDeadline + 1);

        vm.prank(BUYER);
        escrow.cancelExpiredOrder(ORDER_ID);

        assertEq(uint256(escrow.getOrder(ORDER_ID).status), uint256(SettlementEscrow.OrderStatus.Cancelled));
    }

    function testOperatorCanCancelAfterFundingDeadline() public {
        _createDefaultOrder();
        vm.warp(fundingDeadline + 1);

        vm.prank(OPERATOR);
        escrow.cancelExpiredOrder(ORDER_ID);

        assertEq(uint256(escrow.getOrder(ORDER_ID).status), uint256(SettlementEscrow.OrderStatus.Cancelled));
    }

    function testUnrelatedAccountCanCancelAfterFundingDeadline() public {
        _createDefaultOrder();
        vm.warp(fundingDeadline + 1);

        vm.prank(UNAUTHORIZED);
        escrow.cancelExpiredOrder(ORDER_ID);

        assertEq(uint256(escrow.getOrder(ORDER_ID).status), uint256(SettlementEscrow.OrderStatus.Cancelled));
    }

    function testCancellationSucceedsAtFundingDeadline() public {
        _createDefaultOrder();
        vm.warp(fundingDeadline);

        vm.prank(UNAUTHORIZED);
        escrow.cancelExpiredOrder(ORDER_ID);

        assertEq(uint256(escrow.getOrder(ORDER_ID).status), uint256(SettlementEscrow.OrderStatus.Cancelled));
    }

    function testCancellationRejectsBeforeFundingDeadline() public {
        _createDefaultOrder();
        vm.warp(fundingDeadline - 1);

        vm.prank(BUYER);
        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.FundingDeadlineNotReached.selector, fundingDeadline));
        escrow.cancelExpiredOrder(ORDER_ID);
    }

    function testCancellationRejectsUnknownOrder() public {
        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.OrderNotFound.selector, ORDER_ID));
        escrow.cancelExpiredOrder(ORDER_ID);
    }

    function testCancellationRejectsFundedOrder() public {
        _createAndFundDefaultOrder();
        vm.warp(fundingDeadline);

        vm.expectRevert(
            abi.encodeWithSelector(SettlementEscrow.InvalidOrderStatus.selector, SettlementEscrow.OrderStatus.Funded)
        );
        escrow.cancelExpiredOrder(ORDER_ID);
    }

    function testCancellationRejectsDisputedOrder() public {
        _createAndDisputeDefaultOrder();
        vm.warp(fundingDeadline);

        vm.expectRevert(
            abi.encodeWithSelector(SettlementEscrow.InvalidOrderStatus.selector, SettlementEscrow.OrderStatus.Disputed)
        );
        escrow.cancelExpiredOrder(ORDER_ID);
    }

    function testCancellationRejectsCompletedOrder() public {
        _createAndFundDefaultOrder();
        vm.prank(BUYER);
        escrow.releaseOrder(ORDER_ID);
        vm.warp(fundingDeadline);

        vm.expectRevert(
            abi.encodeWithSelector(SettlementEscrow.InvalidOrderStatus.selector, SettlementEscrow.OrderStatus.Completed)
        );
        escrow.cancelExpiredOrder(ORDER_ID);
    }

    function testCancellationRejectsRefundedOrder() public {
        _createAndFundDefaultOrder();
        vm.prank(OPERATOR);
        escrow.refundOrder(ORDER_ID);
        vm.warp(fundingDeadline);

        vm.expectRevert(
            abi.encodeWithSelector(SettlementEscrow.InvalidOrderStatus.selector, SettlementEscrow.OrderStatus.Refunded)
        );
        escrow.cancelExpiredOrder(ORDER_ID);
    }

    function testCancellationRejectsDuplicateCancellation() public {
        _createDefaultOrder();
        vm.warp(fundingDeadline);
        escrow.cancelExpiredOrder(ORDER_ID);

        vm.expectRevert(
            abi.encodeWithSelector(SettlementEscrow.InvalidOrderStatus.selector, SettlementEscrow.OrderStatus.Cancelled)
        );
        escrow.cancelExpiredOrder(ORDER_ID);
    }

    function testCancellationStoresStatusAndTimestamp() public {
        _createDefaultOrder();
        vm.warp(fundingDeadline + 3 hours);
        uint256 expectedCancelledAt = block.timestamp;

        escrow.cancelExpiredOrder(ORDER_ID);

        SettlementEscrow.Order memory order = escrow.getOrder(ORDER_ID);
        assertEq(uint256(order.status), uint256(SettlementEscrow.OrderStatus.Cancelled));
        assertEq(order.cancelledAt, expectedCancelledAt);
    }

    function testCancellationEmitsOrderCancelledEvent() public {
        _createDefaultOrder();
        vm.warp(fundingDeadline);
        uint256 expectedCancelledAt = block.timestamp;

        vm.expectEmit(true, true, true, true, address(escrow));
        emit OrderCancelled(ORDER_ID, UNAUTHORIZED, BUYER, expectedCancelledAt);

        vm.prank(UNAUTHORIZED);
        escrow.cancelExpiredOrder(ORDER_ID);
    }

    function testCancellationLeavesTotalActiveEscrowAndTokenBalancesUnchanged() public {
        _createDefaultOrder();
        usdc.mint(BUYER, TOTAL_AMOUNT);
        usdc.mint(RECIPIENT_ONE, 11_000_000);
        usdc.mint(RECIPIENT_TWO, 22_000_000);
        uint256 totalActiveEscrowBefore = escrow.totalActiveEscrow();
        uint256 escrowBalanceBefore = usdc.balanceOf(address(escrow));
        uint256 buyerBalanceBefore = usdc.balanceOf(BUYER);
        uint256 recipientOneBalanceBefore = usdc.balanceOf(RECIPIENT_ONE);
        uint256 recipientTwoBalanceBefore = usdc.balanceOf(RECIPIENT_TWO);
        vm.warp(fundingDeadline);

        escrow.cancelExpiredOrder(ORDER_ID);

        assertEq(escrow.totalActiveEscrow(), totalActiveEscrowBefore);
        assertEq(usdc.balanceOf(address(escrow)), escrowBalanceBefore);
        assertEq(usdc.balanceOf(BUYER), buyerBalanceBefore);
        assertEq(usdc.balanceOf(RECIPIENT_ONE), recipientOneBalanceBefore);
        assertEq(usdc.balanceOf(RECIPIENT_TWO), recipientTwoBalanceBefore);
    }

    function testCancellationPreservesOrderTermsSplitsAndEarlierTimestamps() public {
        _createDefaultOrder();
        SettlementEscrow.Order memory beforeCancellation = escrow.getOrder(ORDER_ID);
        (address[] memory recipientsBefore, uint16[] memory sharesBefore) = escrow.getSettlementSplits(ORDER_ID);
        vm.warp(fundingDeadline);

        escrow.cancelExpiredOrder(ORDER_ID);

        SettlementEscrow.Order memory afterCancellation = escrow.getOrder(ORDER_ID);
        (address[] memory recipientsAfter, uint16[] memory sharesAfter) = escrow.getSettlementSplits(ORDER_ID);
        assertEq(afterCancellation.buyer, beforeCancellation.buyer);
        assertEq(afterCancellation.totalAmount, beforeCancellation.totalAmount);
        assertEq(afterCancellation.fundingDeadline, beforeCancellation.fundingDeadline);
        assertEq(afterCancellation.settlementDeadline, beforeCancellation.settlementDeadline);
        assertEq(afterCancellation.termsHash, beforeCancellation.termsHash);
        assertEq(afterCancellation.createdAt, beforeCancellation.createdAt);
        assertEq(afterCancellation.fundedAt, beforeCancellation.fundedAt);
        assertEq(afterCancellation.disputedAt, beforeCancellation.disputedAt);
        assertEq(afterCancellation.settledAt, beforeCancellation.settledAt);
        assertEq(afterCancellation.refundedAt, beforeCancellation.refundedAt);
        assertEq(afterCancellation.fundedAt, 0);
        assertEq(afterCancellation.disputedAt, 0);
        assertEq(afterCancellation.settledAt, 0);
        assertEq(afterCancellation.refundedAt, 0);
        assertEq(recipientsAfter, recipientsBefore);
        assertEq(sharesAfter.length, sharesBefore.length);
        for (uint256 i = 0; i < sharesBefore.length; ++i) {
            assertEq(sharesAfter[i], sharesBefore[i]);
        }
    }

    function testBuyerCanRaiseDispute() public {
        _createAndFundDefaultOrder();

        vm.prank(BUYER);
        escrow.raiseDispute(ORDER_ID);

        assertEq(uint256(escrow.getOrder(ORDER_ID).status), uint256(SettlementEscrow.OrderStatus.Disputed));
    }

    function testOperatorCanRaiseDispute() public {
        _createAndFundDefaultOrder();

        vm.prank(OPERATOR);
        escrow.raiseDispute(ORDER_ID);

        assertEq(uint256(escrow.getOrder(ORDER_ID).status), uint256(SettlementEscrow.OrderStatus.Disputed));
    }

    function testUnrelatedAccountCannotRaiseDispute() public {
        _createAndFundDefaultOrder();

        vm.prank(UNAUTHORIZED);
        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.UnauthorizedDisputeCaller.selector, UNAUTHORIZED));
        escrow.raiseDispute(ORDER_ID);
    }

    function testAdministratorWithoutOperatorRoleCannotRaiseDispute() public {
        _createAndFundDefaultOrder();

        vm.prank(ADMIN);
        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.UnauthorizedDisputeCaller.selector, ADMIN));
        escrow.raiseDispute(ORDER_ID);
    }

    function testDisputeRejectsUnknownOrder() public {
        vm.prank(BUYER);
        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.OrderNotFound.selector, ORDER_ID));
        escrow.raiseDispute(ORDER_ID);
    }

    function testDisputeRejectsOrderBeforeFunding() public {
        _createDefaultOrder();

        vm.prank(BUYER);
        vm.expectRevert(
            abi.encodeWithSelector(SettlementEscrow.InvalidOrderStatus.selector, SettlementEscrow.OrderStatus.Created)
        );
        escrow.raiseDispute(ORDER_ID);
    }

    function testDisputeRejectsDuplicateDispute() public {
        _createAndFundDefaultOrder();

        vm.startPrank(BUYER);
        escrow.raiseDispute(ORDER_ID);
        vm.expectRevert(
            abi.encodeWithSelector(SettlementEscrow.InvalidOrderStatus.selector, SettlementEscrow.OrderStatus.Disputed)
        );
        escrow.raiseDispute(ORDER_ID);
        vm.stopPrank();
    }

    function testDisputeStoresDisputedStatus() public {
        _createAndFundDefaultOrder();

        vm.prank(BUYER);
        escrow.raiseDispute(ORDER_ID);

        assertEq(uint256(escrow.getOrder(ORDER_ID).status), uint256(SettlementEscrow.OrderStatus.Disputed));
    }

    function testDisputeStoresTimestamp() public {
        _createAndFundDefaultOrder();
        vm.warp(block.timestamp + 3 hours);
        uint256 expectedDisputedAt = block.timestamp;

        vm.prank(BUYER);
        escrow.raiseDispute(ORDER_ID);

        assertEq(escrow.getOrder(ORDER_ID).disputedAt, expectedDisputedAt);
    }

    function testDisputeEmitsOrderDisputedEvent() public {
        _createAndFundDefaultOrder();
        uint256 expectedDisputedAt = block.timestamp;

        vm.expectEmit(true, true, true, true, address(escrow));
        emit OrderDisputed(ORDER_ID, OPERATOR, BUYER, expectedDisputedAt);

        vm.prank(OPERATOR);
        escrow.raiseDispute(ORDER_ID);
    }

    function testDisputeLeavesTotalActiveEscrowUnchanged() public {
        _createAndFundDefaultOrder();
        uint256 totalActiveEscrowBefore = escrow.totalActiveEscrow();

        vm.prank(BUYER);
        escrow.raiseDispute(ORDER_ID);

        assertEq(escrow.totalActiveEscrow(), totalActiveEscrowBefore);
    }

    function testDisputeLeavesEscrowTokenBalanceUnchanged() public {
        _createAndFundDefaultOrder();
        uint256 escrowBalanceBefore = usdc.balanceOf(address(escrow));

        vm.prank(BUYER);
        escrow.raiseDispute(ORDER_ID);

        assertEq(usdc.balanceOf(address(escrow)), escrowBalanceBefore);
    }

    function testDisputeLeavesBuyerAndRecipientBalancesUnchanged() public {
        _createAndFundDefaultOrder();
        uint256 buyerBalanceBefore = usdc.balanceOf(BUYER);
        uint256 recipientOneBalanceBefore = usdc.balanceOf(RECIPIENT_ONE);
        uint256 recipientTwoBalanceBefore = usdc.balanceOf(RECIPIENT_TWO);

        vm.prank(BUYER);
        escrow.raiseDispute(ORDER_ID);

        assertEq(usdc.balanceOf(BUYER), buyerBalanceBefore);
        assertEq(usdc.balanceOf(RECIPIENT_ONE), recipientOneBalanceBefore);
        assertEq(usdc.balanceOf(RECIPIENT_TWO), recipientTwoBalanceBefore);
    }

    function testReleaseRejectsDisputedOrder() public {
        _createAndFundDefaultOrder();
        vm.prank(BUYER);
        escrow.raiseDispute(ORDER_ID);

        vm.prank(BUYER);
        vm.expectRevert(
            abi.encodeWithSelector(SettlementEscrow.InvalidOrderStatus.selector, SettlementEscrow.OrderStatus.Disputed)
        );
        escrow.releaseOrder(ORDER_ID);
    }

    function testRefundRejectsDisputedOrder() public {
        _createAndFundDefaultOrder();
        vm.prank(BUYER);
        escrow.raiseDispute(ORDER_ID);

        vm.prank(OPERATOR);
        vm.expectRevert(
            abi.encodeWithSelector(SettlementEscrow.InvalidOrderStatus.selector, SettlementEscrow.OrderStatus.Disputed)
        );
        escrow.refundOrder(ORDER_ID);
    }

    function testArbitratorResolvesDisputeToRelease() public {
        _createAndDisputeDefaultOrder();
        vm.warp(block.timestamp + 3 hours);
        uint256 expectedResolvedAt = block.timestamp;

        vm.expectEmit(true, true, false, true, address(escrow));
        emit SettlementPaid(ORDER_ID, RECIPIENT_ONE, 75_000_000);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit SettlementPaid(ORDER_ID, RECIPIENT_TWO, 50_000_000);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit OrderReleased(ORDER_ID, BUYER, TOTAL_AMOUNT, expectedResolvedAt);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit DisputeResolved(
            ORDER_ID, ARBITRATOR, SettlementEscrow.DisputeResolution.Release, TOTAL_AMOUNT, expectedResolvedAt
        );

        vm.prank(ARBITRATOR);
        escrow.resolveDispute(ORDER_ID, SettlementEscrow.DisputeResolution.Release);

        SettlementEscrow.Order memory order = escrow.getOrder(ORDER_ID);
        assertEq(uint256(order.status), uint256(SettlementEscrow.OrderStatus.Completed));
        assertEq(order.settledAt, expectedResolvedAt);
        assertEq(order.refundedAt, 0);
        assertEq(usdc.balanceOf(RECIPIENT_ONE), 75_000_000);
        assertEq(usdc.balanceOf(RECIPIENT_TWO), 50_000_000);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        assertEq(escrow.totalActiveEscrow(), 0);
    }

    function testArbitratorResolvesDisputeToRefund() public {
        _createAndDisputeDefaultOrder();
        vm.warp(block.timestamp + 3 hours);
        uint256 expectedResolvedAt = block.timestamp;
        uint256 buyerBalanceBefore = usdc.balanceOf(BUYER);

        vm.expectEmit(true, true, false, true, address(escrow));
        emit OrderRefunded(ORDER_ID, BUYER, TOTAL_AMOUNT, expectedResolvedAt);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit DisputeResolved(
            ORDER_ID, ARBITRATOR, SettlementEscrow.DisputeResolution.Refund, TOTAL_AMOUNT, expectedResolvedAt
        );

        vm.prank(ARBITRATOR);
        escrow.resolveDispute(ORDER_ID, SettlementEscrow.DisputeResolution.Refund);

        SettlementEscrow.Order memory order = escrow.getOrder(ORDER_ID);
        assertEq(uint256(order.status), uint256(SettlementEscrow.OrderStatus.Refunded));
        assertEq(order.refundedAt, expectedResolvedAt);
        assertEq(order.settledAt, 0);
        assertEq(usdc.balanceOf(BUYER) - buyerBalanceBefore, TOTAL_AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        assertEq(escrow.totalActiveEscrow(), 0);
    }

    function testDisputeResolutionPreservesOrderDataAndSettlementSplits() public {
        _createAndDisputeDefaultOrder();
        SettlementEscrow.Order memory beforeResolution = escrow.getOrder(ORDER_ID);

        vm.prank(ARBITRATOR);
        escrow.resolveDispute(ORDER_ID, SettlementEscrow.DisputeResolution.Release);

        SettlementEscrow.Order memory afterResolution = escrow.getOrder(ORDER_ID);
        assertEq(afterResolution.buyer, beforeResolution.buyer);
        assertEq(afterResolution.totalAmount, beforeResolution.totalAmount);
        assertEq(afterResolution.fundingDeadline, beforeResolution.fundingDeadline);
        assertEq(afterResolution.settlementDeadline, beforeResolution.settlementDeadline);
        assertEq(afterResolution.termsHash, beforeResolution.termsHash);
        assertEq(afterResolution.createdAt, beforeResolution.createdAt);
        assertEq(afterResolution.fundedAt, beforeResolution.fundedAt);
        assertEq(afterResolution.disputedAt, beforeResolution.disputedAt);

        (address[] memory recipients, uint16[] memory shares) = escrow.getSettlementSplits(ORDER_ID);
        assertEq(recipients[0], RECIPIENT_ONE);
        assertEq(recipients[1], RECIPIENT_TWO);
        assertEq(shares[0], 6_000);
        assertEq(shares[1], 4_000);
    }

    function testDisputeReleaseAssignsRoundingRemainderToFinalRecipient() public {
        address[] memory recipients = new address[](2);
        recipients[0] = RECIPIENT_ONE;
        recipients[1] = RECIPIENT_TWO;
        uint16[] memory shares = new uint16[](2);
        shares[0] = 3_333;
        shares[1] = 6_667;

        vm.prank(OPERATOR);
        escrow.createOrder(ORDER_ID, BUYER, 101, fundingDeadline, settlementDeadline, TERMS_HASH, recipients, shares);
        _prepareBuyerFunding(101, 101);
        vm.prank(BUYER);
        escrow.fundOrder(ORDER_ID);
        vm.prank(BUYER);
        escrow.raiseDispute(ORDER_ID);

        vm.prank(ARBITRATOR);
        escrow.resolveDispute(ORDER_ID, SettlementEscrow.DisputeResolution.Release);

        assertEq(usdc.balanceOf(RECIPIENT_ONE), 33);
        assertEq(usdc.balanceOf(RECIPIENT_TWO), 68);
        assertEq(usdc.balanceOf(RECIPIENT_ONE) + usdc.balanceOf(RECIPIENT_TWO), 101);
    }

    function testBuyerWithoutArbitratorRoleCannotResolveDispute() public {
        _expectUnauthorizedResolution(BUYER);
    }

    function testOperatorWithoutArbitratorRoleCannotResolveDispute() public {
        _expectUnauthorizedResolution(OPERATOR);
    }

    function testAdministratorWithoutArbitratorRoleCannotResolveDispute() public {
        _expectUnauthorizedResolution(ADMIN);
    }

    function testUnrelatedAccountCannotResolveDispute() public {
        _expectUnauthorizedResolution(UNAUTHORIZED);
    }

    function testResolutionRejectsUnknownOrder() public {
        vm.prank(ARBITRATOR);
        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.OrderNotFound.selector, ORDER_ID));
        escrow.resolveDispute(ORDER_ID, SettlementEscrow.DisputeResolution.Release);
    }

    function testResolutionRejectsOrderBeforeDispute() public {
        _createAndFundDefaultOrder();

        vm.prank(ARBITRATOR);
        vm.expectRevert(
            abi.encodeWithSelector(SettlementEscrow.InvalidOrderStatus.selector, SettlementEscrow.OrderStatus.Funded)
        );
        escrow.resolveDispute(ORDER_ID, SettlementEscrow.DisputeResolution.Release);
    }

    function testResolutionRejectsDuplicateResolution() public {
        _createAndDisputeDefaultOrder();
        vm.startPrank(ARBITRATOR);
        escrow.resolveDispute(ORDER_ID, SettlementEscrow.DisputeResolution.Refund);
        vm.expectRevert(
            abi.encodeWithSelector(SettlementEscrow.InvalidOrderStatus.selector, SettlementEscrow.OrderStatus.Refunded)
        );
        escrow.resolveDispute(ORDER_ID, SettlementEscrow.DisputeResolution.Release);
        vm.stopPrank();
    }

    function testResolutionRejectsInvalidNumericEnumValue() public {
        _createAndDisputeDefaultOrder();
        bytes memory callData = abi.encodeWithSelector(SettlementEscrow.resolveDispute.selector, ORDER_ID, uint256(2));

        vm.prank(ARBITRATOR);
        (bool success,) = address(escrow).call(callData);

        assertFalse(success);
        assertEq(uint256(escrow.getOrder(ORDER_ID).status), uint256(SettlementEscrow.OrderStatus.Disputed));
        assertEq(escrow.totalActiveEscrow(), TOTAL_AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), TOTAL_AMOUNT);
    }

    function testDisputeReleaseTransferFailureRevertsAllChanges() public {
        (FailingTransferERC20 failingToken, SettlementEscrow failingEscrow) = _createDisputedFailingEscrow();
        failingToken.setBlockedRecipient(RECIPIENT_TWO);
        uint256 buyerBalanceBefore = failingToken.balanceOf(BUYER);

        vm.prank(ARBITRATOR);
        vm.expectRevert(bytes("TRANSFER_BLOCKED"));
        failingEscrow.resolveDispute(ORDER_ID, SettlementEscrow.DisputeResolution.Release);

        SettlementEscrow.Order memory order = failingEscrow.getOrder(ORDER_ID);
        assertEq(uint256(order.status), uint256(SettlementEscrow.OrderStatus.Disputed));
        assertEq(order.settledAt, 0);
        assertEq(order.refundedAt, 0);
        assertEq(failingEscrow.totalActiveEscrow(), TOTAL_AMOUNT);
        assertEq(failingToken.balanceOf(address(failingEscrow)), TOTAL_AMOUNT);
        assertEq(failingToken.balanceOf(BUYER), buyerBalanceBefore);
        assertEq(failingToken.balanceOf(RECIPIENT_ONE), 0);
        assertEq(failingToken.balanceOf(RECIPIENT_TWO), 0);
    }

    function testDisputeRefundTransferFailureRevertsAllChanges() public {
        (FailingTransferERC20 failingToken, SettlementEscrow failingEscrow) = _createDisputedFailingEscrow();
        failingToken.setBlockedRecipient(BUYER);
        uint256 buyerBalanceBefore = failingToken.balanceOf(BUYER);

        vm.prank(ARBITRATOR);
        vm.expectRevert(bytes("TRANSFER_BLOCKED"));
        failingEscrow.resolveDispute(ORDER_ID, SettlementEscrow.DisputeResolution.Refund);

        SettlementEscrow.Order memory order = failingEscrow.getOrder(ORDER_ID);
        assertEq(uint256(order.status), uint256(SettlementEscrow.OrderStatus.Disputed));
        assertEq(order.settledAt, 0);
        assertEq(order.refundedAt, 0);
        assertEq(failingEscrow.totalActiveEscrow(), TOTAL_AMOUNT);
        assertEq(failingToken.balanceOf(address(failingEscrow)), TOTAL_AMOUNT);
        assertEq(failingToken.balanceOf(BUYER), buyerBalanceBefore);
        assertEq(failingToken.balanceOf(RECIPIENT_ONE), 0);
        assertEq(failingToken.balanceOf(RECIPIENT_TWO), 0);
    }

    function testBuyerCanReleaseOrder() public {
        _createAndFundDefaultOrder();

        vm.prank(BUYER);
        escrow.releaseOrder(ORDER_ID);

        assertEq(uint256(escrow.getOrder(ORDER_ID).status), uint256(SettlementEscrow.OrderStatus.Completed));
    }

    function testOperatorCanReleaseOrder() public {
        _createAndFundDefaultOrder();

        vm.prank(OPERATOR);
        escrow.releaseOrder(ORDER_ID);

        assertEq(uint256(escrow.getOrder(ORDER_ID).status), uint256(SettlementEscrow.OrderStatus.Completed));
    }

    function testUnrelatedAccountCannotReleaseOrder() public {
        _createAndFundDefaultOrder();

        vm.prank(UNAUTHORIZED);
        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.UnauthorizedReleaseCaller.selector, UNAUTHORIZED));
        escrow.releaseOrder(ORDER_ID);
    }

    function testAdministratorWithoutOperatorRoleCannotReleaseOrder() public {
        _createAndFundDefaultOrder();

        vm.prank(ADMIN);
        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.UnauthorizedReleaseCaller.selector, ADMIN));
        escrow.releaseOrder(ORDER_ID);
    }

    function testReleaseRejectsUnknownOrder() public {
        vm.prank(BUYER);
        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.OrderNotFound.selector, ORDER_ID));
        escrow.releaseOrder(ORDER_ID);
    }

    function testReleaseRejectsOrderBeforeFunding() public {
        _createDefaultOrder();

        vm.prank(BUYER);
        vm.expectRevert(
            abi.encodeWithSelector(SettlementEscrow.InvalidOrderStatus.selector, SettlementEscrow.OrderStatus.Created)
        );
        escrow.releaseOrder(ORDER_ID);
    }

    function testReleaseRejectsDuplicateRelease() public {
        _createAndFundDefaultOrder();

        vm.startPrank(BUYER);
        escrow.releaseOrder(ORDER_ID);
        vm.expectRevert(
            abi.encodeWithSelector(SettlementEscrow.InvalidOrderStatus.selector, SettlementEscrow.OrderStatus.Completed)
        );
        escrow.releaseOrder(ORDER_ID);
        vm.stopPrank();
    }

    function testReleaseStoresCompletedStatus() public {
        _createAndFundDefaultOrder();

        vm.prank(BUYER);
        escrow.releaseOrder(ORDER_ID);

        assertEq(uint256(escrow.getOrder(ORDER_ID).status), uint256(SettlementEscrow.OrderStatus.Completed));
    }

    function testReleaseStoresSettlementTimestamp() public {
        _createAndFundDefaultOrder();
        vm.warp(block.timestamp + 3 hours);
        uint256 expectedSettledAt = block.timestamp;

        vm.prank(BUYER);
        escrow.releaseOrder(ORDER_ID);

        assertEq(escrow.getOrder(ORDER_ID).settledAt, expectedSettledAt);
    }

    function testReleaseChangesRecipientBalancesByExactAmounts() public {
        _createAndFundDefaultOrder();

        vm.prank(BUYER);
        escrow.releaseOrder(ORDER_ID);

        assertEq(usdc.balanceOf(RECIPIENT_ONE), 75_000_000);
        assertEq(usdc.balanceOf(RECIPIENT_TWO), 50_000_000);
    }

    function testReleasePaysExactFullOrderAmount() public {
        _createAndFundDefaultOrder();
        uint256 recipientsBalanceBefore = usdc.balanceOf(RECIPIENT_ONE) + usdc.balanceOf(RECIPIENT_TWO);

        vm.prank(BUYER);
        escrow.releaseOrder(ORDER_ID);

        uint256 recipientsBalanceAfter = usdc.balanceOf(RECIPIENT_ONE) + usdc.balanceOf(RECIPIENT_TWO);
        assertEq(recipientsBalanceAfter - recipientsBalanceBefore, TOTAL_AMOUNT);
    }

    function testReleaseAssignsRoundingRemainderToFinalRecipient() public {
        address[] memory recipients = new address[](2);
        recipients[0] = RECIPIENT_ONE;
        recipients[1] = RECIPIENT_TWO;
        uint16[] memory shares = new uint16[](2);
        shares[0] = 3_333;
        shares[1] = 6_667;

        vm.prank(OPERATOR);
        escrow.createOrder(ORDER_ID, BUYER, 101, fundingDeadline, settlementDeadline, TERMS_HASH, recipients, shares);
        _prepareBuyerFunding(101, 101);
        vm.prank(BUYER);
        escrow.fundOrder(ORDER_ID);

        vm.prank(BUYER);
        escrow.releaseOrder(ORDER_ID);

        assertEq(usdc.balanceOf(RECIPIENT_ONE), 33);
        assertEq(usdc.balanceOf(RECIPIENT_TWO), 68);
        assertEq(usdc.balanceOf(RECIPIENT_ONE) + usdc.balanceOf(RECIPIENT_TWO), 101);
    }

    function testReleaseDecreasesTotalActiveEscrowByFullAmount() public {
        _createAndFundDefaultOrder();
        assertEq(escrow.totalActiveEscrow(), TOTAL_AMOUNT);

        vm.prank(BUYER);
        escrow.releaseOrder(ORDER_ID);

        assertEq(escrow.totalActiveEscrow(), 0);
    }

    function testReleaseDecreasesEscrowBalanceByFullAmount() public {
        _createAndFundDefaultOrder();
        uint256 escrowBalanceBefore = usdc.balanceOf(address(escrow));

        vm.prank(BUYER);
        escrow.releaseOrder(ORDER_ID);

        assertEq(escrowBalanceBefore - usdc.balanceOf(address(escrow)), TOTAL_AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function testReleaseEmitsAggregateEvent() public {
        _createAndFundDefaultOrder();
        uint256 expectedSettledAt = block.timestamp;

        vm.expectEmit(true, true, false, true, address(escrow));
        emit OrderReleased(ORDER_ID, BUYER, TOTAL_AMOUNT, expectedSettledAt);

        vm.prank(BUYER);
        escrow.releaseOrder(ORDER_ID);
    }

    function testReleaseEmitsRecipientPaymentEvents() public {
        _createAndFundDefaultOrder();

        vm.expectEmit(true, true, false, true, address(escrow));
        emit SettlementPaid(ORDER_ID, RECIPIENT_ONE, 75_000_000);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit SettlementPaid(ORDER_ID, RECIPIENT_TWO, 50_000_000);

        vm.prank(BUYER);
        escrow.releaseOrder(ORDER_ID);
    }

    function testReleaseTransferFailureRevertsAllState() public {
        (FailingTransferERC20 failingToken, SettlementEscrow failingEscrow) = _createFundedFailingEscrow();
        failingToken.setBlockedRecipient(RECIPIENT_TWO);

        vm.prank(BUYER);
        vm.expectRevert(bytes("TRANSFER_BLOCKED"));
        failingEscrow.releaseOrder(ORDER_ID);

        SettlementEscrow.Order memory order = failingEscrow.getOrder(ORDER_ID);
        assertEq(uint256(order.status), uint256(SettlementEscrow.OrderStatus.Funded));
        assertEq(order.settledAt, 0);
        assertEq(failingEscrow.totalActiveEscrow(), TOTAL_AMOUNT);
        assertEq(failingToken.balanceOf(address(failingEscrow)), TOTAL_AMOUNT);
        assertEq(failingToken.balanceOf(RECIPIENT_ONE), 0);
        assertEq(failingToken.balanceOf(RECIPIENT_TWO), 0);
    }

    function testOperatorCanRefundOrder() public {
        _createAndFundDefaultOrder();

        vm.prank(OPERATOR);
        escrow.refundOrder(ORDER_ID);

        assertEq(uint256(escrow.getOrder(ORDER_ID).status), uint256(SettlementEscrow.OrderStatus.Refunded));
    }

    function testBuyerWithoutOperatorRoleCannotRefundOrder() public {
        _createAndFundDefaultOrder();
        bytes32 operatorRole = escrow.OPERATOR_ROLE();

        vm.prank(BUYER);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, BUYER, operatorRole)
        );
        escrow.refundOrder(ORDER_ID);
    }

    function testUnrelatedAccountCannotRefundOrder() public {
        _createAndFundDefaultOrder();
        bytes32 operatorRole = escrow.OPERATOR_ROLE();

        vm.prank(UNAUTHORIZED);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, UNAUTHORIZED, operatorRole)
        );
        escrow.refundOrder(ORDER_ID);
    }

    function testAdministratorWithoutOperatorRoleCannotRefundOrder() public {
        _createAndFundDefaultOrder();
        bytes32 operatorRole = escrow.OPERATOR_ROLE();

        vm.prank(ADMIN);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, ADMIN, operatorRole)
        );
        escrow.refundOrder(ORDER_ID);
    }

    function testRefundRejectsUnknownOrder() public {
        vm.prank(OPERATOR);
        vm.expectRevert(abi.encodeWithSelector(SettlementEscrow.OrderNotFound.selector, ORDER_ID));
        escrow.refundOrder(ORDER_ID);
    }

    function testRefundRejectsOrderBeforeFunding() public {
        _createDefaultOrder();

        vm.prank(OPERATOR);
        vm.expectRevert(
            abi.encodeWithSelector(SettlementEscrow.InvalidOrderStatus.selector, SettlementEscrow.OrderStatus.Created)
        );
        escrow.refundOrder(ORDER_ID);
    }

    function testRefundRejectsDuplicateRefund() public {
        _createAndFundDefaultOrder();

        vm.startPrank(OPERATOR);
        escrow.refundOrder(ORDER_ID);
        vm.expectRevert(
            abi.encodeWithSelector(SettlementEscrow.InvalidOrderStatus.selector, SettlementEscrow.OrderStatus.Refunded)
        );
        escrow.refundOrder(ORDER_ID);
        vm.stopPrank();
    }

    function testRefundStoresRefundedStatus() public {
        _createAndFundDefaultOrder();

        vm.prank(OPERATOR);
        escrow.refundOrder(ORDER_ID);

        assertEq(uint256(escrow.getOrder(ORDER_ID).status), uint256(SettlementEscrow.OrderStatus.Refunded));
    }

    function testRefundStoresRefundTimestamp() public {
        _createAndFundDefaultOrder();
        vm.warp(block.timestamp + 3 hours);
        uint256 expectedRefundedAt = block.timestamp;

        vm.prank(OPERATOR);
        escrow.refundOrder(ORDER_ID);

        assertEq(escrow.getOrder(ORDER_ID).refundedAt, expectedRefundedAt);
    }

    function testRefundRestoresExactBuyerBalance() public {
        _createDefaultOrder();
        uint256 initialBuyerBalance = TOTAL_AMOUNT + 25_000_000;
        _prepareBuyerFunding(initialBuyerBalance, TOTAL_AMOUNT);
        vm.prank(BUYER);
        escrow.fundOrder(ORDER_ID);
        uint256 buyerBalanceBefore = usdc.balanceOf(BUYER);

        vm.prank(OPERATOR);
        escrow.refundOrder(ORDER_ID);

        assertEq(usdc.balanceOf(BUYER) - buyerBalanceBefore, TOTAL_AMOUNT);
        assertEq(usdc.balanceOf(BUYER), initialBuyerBalance);
    }

    function testRefundDecreasesEscrowBalanceByFullAmount() public {
        _createAndFundDefaultOrder();
        uint256 escrowBalanceBefore = usdc.balanceOf(address(escrow));

        vm.prank(OPERATOR);
        escrow.refundOrder(ORDER_ID);

        assertEq(escrowBalanceBefore - usdc.balanceOf(address(escrow)), TOTAL_AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function testRefundDecreasesTotalActiveEscrowByFullAmount() public {
        _createAndFundDefaultOrder();
        assertEq(escrow.totalActiveEscrow(), TOTAL_AMOUNT);

        vm.prank(OPERATOR);
        escrow.refundOrder(ORDER_ID);

        assertEq(escrow.totalActiveEscrow(), 0);
    }

    function testRefundEmitsOrderRefundedEvent() public {
        _createAndFundDefaultOrder();
        uint256 expectedRefundedAt = block.timestamp;

        vm.expectEmit(true, true, false, true, address(escrow));
        emit OrderRefunded(ORDER_ID, BUYER, TOTAL_AMOUNT, expectedRefundedAt);

        vm.prank(OPERATOR);
        escrow.refundOrder(ORDER_ID);
    }

    function testRefundTransferFailureRevertsAllState() public {
        (FailingTransferERC20 failingToken, SettlementEscrow failingEscrow) = _createFundedFailingEscrow();
        failingToken.setBlockedRecipient(BUYER);
        uint256 buyerBalanceBefore = failingToken.balanceOf(BUYER);
        uint256 escrowBalanceBefore = failingToken.balanceOf(address(failingEscrow));

        vm.prank(OPERATOR);
        vm.expectRevert(bytes("TRANSFER_BLOCKED"));
        failingEscrow.refundOrder(ORDER_ID);

        SettlementEscrow.Order memory order = failingEscrow.getOrder(ORDER_ID);
        assertEq(uint256(order.status), uint256(SettlementEscrow.OrderStatus.Funded));
        assertEq(order.refundedAt, 0);
        assertEq(failingEscrow.totalActiveEscrow(), TOTAL_AMOUNT);
        assertEq(failingToken.balanceOf(address(failingEscrow)), escrowBalanceBefore);
        assertEq(failingToken.balanceOf(BUYER), buyerBalanceBefore);
    }

    function testAssignsInitialPauserRole() public view {
        assertTrue(escrow.hasRole(escrow.PAUSER_ROLE(), PAUSER));
    }

    function testPauserCanPause() public {
        _pause();

        assertTrue(escrow.paused());
    }

    function testPauserCanUnpause() public {
        _pause();
        _unpause();

        assertFalse(escrow.paused());
    }

    function testAdministratorWithoutPauserRoleCannotPause() public {
        _expectUnauthorizedPause(ADMIN);
    }

    function testAdministratorWithoutPauserRoleCannotUnpause() public {
        _pause();
        _expectUnauthorizedUnpause(ADMIN);
    }

    function testOperatorWithoutPauserRoleCannotPause() public {
        _expectUnauthorizedPause(OPERATOR);
    }

    function testArbitratorWithoutPauserRoleCannotPause() public {
        _expectUnauthorizedPause(ARBITRATOR);
    }

    function testUnrelatedAccountCannotPause() public {
        _expectUnauthorizedPause(UNAUTHORIZED);
    }

    function testUnrelatedAccountCannotUnpause() public {
        _pause();
        _expectUnauthorizedUnpause(UNAUTHORIZED);
    }

    function testDuplicatePauseFails() public {
        _pause();

        vm.prank(PAUSER);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.pause();
    }

    function testUnpauseWhileNotPausedFails() public {
        vm.prank(PAUSER);
        vm.expectRevert(Pausable.ExpectedPause.selector);
        escrow.unpause();
    }

    function testPauseEmitsStandardEvent() public {
        vm.expectEmit(false, false, false, true, address(escrow));
        emit Paused(PAUSER);

        _pause();
    }

    function testUnpauseEmitsStandardEvent() public {
        _pause();

        vm.expectEmit(false, false, false, true, address(escrow));
        emit Unpaused(PAUSER);

        _unpause();
    }

    function testCreateOrderRejectedWhilePausedWithoutChanges() public {
        BalanceSnapshot memory balancesBefore = _snapshotBalances();
        _pause();
        (address[] memory recipients, uint16[] memory shares) = _defaultSplits();

        vm.prank(OPERATOR);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        _createOrder(recipients, shares);

        assertFalse(escrow.orderExists(ORDER_ID));
        _assertBalancesUnchanged(balancesBefore);
    }

    function testFundOrderRejectedWhilePausedWithoutChanges() public {
        _createDefaultOrder();
        _prepareBuyerFunding(TOTAL_AMOUNT, TOTAL_AMOUNT);
        SettlementEscrow.Order memory orderBefore = escrow.getOrder(ORDER_ID);
        BalanceSnapshot memory balancesBefore = _snapshotBalances();
        _pause();

        vm.prank(BUYER);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.fundOrder(ORDER_ID);

        _assertOrderUnchanged(orderBefore, escrow.getOrder(ORDER_ID));
        _assertBalancesUnchanged(balancesBefore);
    }

    function testReleaseOrderRejectedWhilePausedWithoutChanges() public {
        _createAndFundDefaultOrder();
        SettlementEscrow.Order memory orderBefore = escrow.getOrder(ORDER_ID);
        BalanceSnapshot memory balancesBefore = _snapshotBalances();
        _pause();

        vm.prank(BUYER);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.releaseOrder(ORDER_ID);

        _assertOrderUnchanged(orderBefore, escrow.getOrder(ORDER_ID));
        _assertBalancesUnchanged(balancesBefore);
    }

    function testRefundOrderRejectedWhilePausedWithoutChanges() public {
        _createAndFundDefaultOrder();
        SettlementEscrow.Order memory orderBefore = escrow.getOrder(ORDER_ID);
        BalanceSnapshot memory balancesBefore = _snapshotBalances();
        _pause();

        vm.prank(OPERATOR);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.refundOrder(ORDER_ID);

        _assertOrderUnchanged(orderBefore, escrow.getOrder(ORDER_ID));
        _assertBalancesUnchanged(balancesBefore);
    }

    function testRaiseDisputeRejectedWhilePausedWithoutChanges() public {
        _createAndFundDefaultOrder();
        SettlementEscrow.Order memory orderBefore = escrow.getOrder(ORDER_ID);
        BalanceSnapshot memory balancesBefore = _snapshotBalances();
        _pause();

        vm.prank(BUYER);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.raiseDispute(ORDER_ID);

        _assertOrderUnchanged(orderBefore, escrow.getOrder(ORDER_ID));
        _assertBalancesUnchanged(balancesBefore);
    }

    function testResolveDisputeRejectedWhilePausedWithoutChanges() public {
        _createAndDisputeDefaultOrder();
        SettlementEscrow.Order memory orderBefore = escrow.getOrder(ORDER_ID);
        BalanceSnapshot memory balancesBefore = _snapshotBalances();
        _pause();

        vm.prank(ARBITRATOR);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.resolveDispute(ORDER_ID, SettlementEscrow.DisputeResolution.Release);

        _assertOrderUnchanged(orderBefore, escrow.getOrder(ORDER_ID));
        _assertBalancesUnchanged(balancesBefore);
    }

    function testCancelExpiredOrderRejectedWhilePausedWithoutChanges() public {
        _createDefaultOrder();
        vm.warp(fundingDeadline);
        SettlementEscrow.Order memory orderBefore = escrow.getOrder(ORDER_ID);
        BalanceSnapshot memory balancesBefore = _snapshotBalances();
        _pause();

        vm.prank(UNAUTHORIZED);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.cancelExpiredOrder(ORDER_ID);

        _assertOrderUnchanged(orderBefore, escrow.getOrder(ORDER_ID));
        _assertBalancesUnchanged(balancesBefore);
    }

    function testCreateOrderWorksAfterUnpause() public {
        _pause();
        _unpause();

        _createDefaultOrder();

        assertTrue(escrow.orderExists(ORDER_ID));
    }

    function testFundOrderWorksAfterUnpause() public {
        _createDefaultOrder();
        _prepareBuyerFunding(TOTAL_AMOUNT, TOTAL_AMOUNT);
        _pause();
        _unpause();

        vm.prank(BUYER);
        escrow.fundOrder(ORDER_ID);

        assertEq(uint256(escrow.getOrder(ORDER_ID).status), uint256(SettlementEscrow.OrderStatus.Funded));
        assertEq(escrow.totalActiveEscrow(), TOTAL_AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), TOTAL_AMOUNT);
    }

    function testReleaseOrderWorksAfterUnpause() public {
        _createAndFundDefaultOrder();
        _pause();
        _unpause();

        vm.prank(BUYER);
        escrow.releaseOrder(ORDER_ID);

        assertEq(uint256(escrow.getOrder(ORDER_ID).status), uint256(SettlementEscrow.OrderStatus.Completed));
        assertEq(usdc.balanceOf(RECIPIENT_ONE), 75_000_000);
        assertEq(usdc.balanceOf(RECIPIENT_TWO), 50_000_000);
    }

    function testRefundOrderWorksAfterUnpause() public {
        _createAndFundDefaultOrder();
        _pause();
        _unpause();

        vm.prank(OPERATOR);
        escrow.refundOrder(ORDER_ID);

        assertEq(uint256(escrow.getOrder(ORDER_ID).status), uint256(SettlementEscrow.OrderStatus.Refunded));
        assertEq(usdc.balanceOf(BUYER), TOTAL_AMOUNT);
    }

    function testRaiseDisputeWorksAfterUnpause() public {
        _createAndFundDefaultOrder();
        _pause();
        _unpause();

        vm.prank(BUYER);
        escrow.raiseDispute(ORDER_ID);

        assertEq(uint256(escrow.getOrder(ORDER_ID).status), uint256(SettlementEscrow.OrderStatus.Disputed));
    }

    function testResolveDisputeWorksAfterUnpause() public {
        _createAndDisputeDefaultOrder();
        _pause();
        _unpause();

        vm.prank(ARBITRATOR);
        escrow.resolveDispute(ORDER_ID, SettlementEscrow.DisputeResolution.Release);

        assertEq(uint256(escrow.getOrder(ORDER_ID).status), uint256(SettlementEscrow.OrderStatus.Completed));
        assertEq(usdc.balanceOf(RECIPIENT_ONE), 75_000_000);
        assertEq(usdc.balanceOf(RECIPIENT_TWO), 50_000_000);
    }

    function testCancelExpiredOrderWorksAfterUnpause() public {
        _createDefaultOrder();
        vm.warp(fundingDeadline);
        _pause();
        _unpause();

        vm.prank(UNAUTHORIZED);
        escrow.cancelExpiredOrder(ORDER_ID);

        assertEq(uint256(escrow.getOrder(ORDER_ID).status), uint256(SettlementEscrow.OrderStatus.Cancelled));
    }

    function testReadFunctionsWorkWhilePaused() public {
        _createAndFundDefaultOrder();
        _pause();

        SettlementEscrow.Order memory order = escrow.getOrder(ORDER_ID);
        (address[] memory recipients, uint16[] memory shares) = escrow.getSettlementSplits(ORDER_ID);

        assertTrue(escrow.paused());
        assertTrue(escrow.orderExists(ORDER_ID));
        assertEq(uint256(order.status), uint256(SettlementEscrow.OrderStatus.Funded));
        assertEq(recipients[0], RECIPIENT_ONE);
        assertEq(recipients[1], RECIPIENT_TWO);
        assertEq(shares[0], 6_000);
        assertEq(shares[1], 4_000);
        assertEq(escrow.totalActiveEscrow(), TOTAL_AMOUNT);
        assertEq(address(escrow.usdc()), address(usdc));
    }

    function testPauseDoesNotChangeAccountingBalancesOrOrderData() public {
        _createAndFundDefaultOrder();
        SettlementEscrow.Order memory orderBefore = escrow.getOrder(ORDER_ID);
        BalanceSnapshot memory balancesBefore = _snapshotBalances();
        (address[] memory recipientsBefore, uint16[] memory sharesBefore) = escrow.getSettlementSplits(ORDER_ID);

        _pause();

        _assertOrderUnchanged(orderBefore, escrow.getOrder(ORDER_ID));
        _assertBalancesUnchanged(balancesBefore);
        (address[] memory recipientsAfter, uint16[] memory sharesAfter) = escrow.getSettlementSplits(ORDER_ID);
        assertEq(recipientsAfter, recipientsBefore);
        assertEq(sharesAfter.length, sharesBefore.length);
        for (uint256 i = 0; i < sharesBefore.length; ++i) {
            assertEq(sharesAfter[i], sharesBefore[i]);
        }
    }

    function _createDefaultOrder() private {
        (address[] memory recipients, uint16[] memory shares) = _defaultSplits();
        vm.prank(OPERATOR);
        _createOrder(recipients, shares);
    }

    function _createAndFundDefaultOrder() private {
        _createDefaultOrder();
        _prepareBuyerFunding(TOTAL_AMOUNT, TOTAL_AMOUNT);
        vm.prank(BUYER);
        escrow.fundOrder(ORDER_ID);
    }

    function _createFundedFailingEscrow()
        private
        returns (FailingTransferERC20 failingToken, SettlementEscrow failingEscrow)
    {
        failingToken = new FailingTransferERC20();
        failingEscrow = new SettlementEscrow(address(failingToken), ADMIN, OPERATOR, ARBITRATOR, PAUSER);
        (address[] memory recipients, uint16[] memory shares) = _defaultSplits();

        vm.prank(OPERATOR);
        failingEscrow.createOrder(
            ORDER_ID, BUYER, TOTAL_AMOUNT, fundingDeadline, settlementDeadline, TERMS_HASH, recipients, shares
        );
        failingToken.mint(BUYER, TOTAL_AMOUNT);
        vm.prank(BUYER);
        failingToken.approve(address(failingEscrow), TOTAL_AMOUNT);
        vm.prank(BUYER);
        failingEscrow.fundOrder(ORDER_ID);
    }

    function _createAndDisputeDefaultOrder() private {
        _createAndFundDefaultOrder();
        vm.prank(BUYER);
        escrow.raiseDispute(ORDER_ID);
    }

    function _createDisputedFailingEscrow()
        private
        returns (FailingTransferERC20 failingToken, SettlementEscrow failingEscrow)
    {
        (failingToken, failingEscrow) = _createFundedFailingEscrow();
        vm.prank(BUYER);
        failingEscrow.raiseDispute(ORDER_ID);
    }

    function _expectUnauthorizedResolution(address caller) private {
        _createAndDisputeDefaultOrder();
        bytes32 arbitratorRole = escrow.ARBITRATOR_ROLE();

        vm.prank(caller);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, caller, arbitratorRole)
        );
        escrow.resolveDispute(ORDER_ID, SettlementEscrow.DisputeResolution.Release);
    }

    function _createOrder(address[] memory recipients, uint16[] memory shares) private {
        escrow.createOrder(
            ORDER_ID, BUYER, TOTAL_AMOUNT, fundingDeadline, settlementDeadline, TERMS_HASH, recipients, shares
        );
    }

    function _expectCreateRevert(
        bytes4 errorSelector,
        bytes32 orderId,
        address buyer,
        uint256 amount,
        uint256 orderFundingDeadline,
        uint256 orderSettlementDeadline,
        bytes32 termsHash
    ) private {
        (address[] memory recipients, uint16[] memory shares) = _defaultSplits();
        vm.prank(OPERATOR);
        vm.expectRevert(errorSelector);
        escrow.createOrder(
            orderId, buyer, amount, orderFundingDeadline, orderSettlementDeadline, termsHash, recipients, shares
        );
    }

    function _defaultSplits() private pure returns (address[] memory recipients, uint16[] memory shares) {
        recipients = new address[](2);
        recipients[0] = RECIPIENT_ONE;
        recipients[1] = RECIPIENT_TWO;

        shares = new uint16[](2);
        shares[0] = 6_000;
        shares[1] = 4_000;
    }

    function _prepareBuyerFunding(uint256 balance, uint256 allowance) private {
        usdc.mint(BUYER, balance);
        vm.prank(BUYER);
        usdc.approve(address(escrow), allowance);
    }

    function _pause() private {
        vm.prank(PAUSER);
        escrow.pause();
    }

    function _unpause() private {
        vm.prank(PAUSER);
        escrow.unpause();
    }

    function _expectUnauthorizedPause(address caller) private {
        bytes32 pauserRole = escrow.PAUSER_ROLE();

        vm.prank(caller);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, caller, pauserRole)
        );
        escrow.pause();
    }

    function _expectUnauthorizedUnpause(address caller) private {
        bytes32 pauserRole = escrow.PAUSER_ROLE();

        vm.prank(caller);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, caller, pauserRole)
        );
        escrow.unpause();
    }

    function _snapshotBalances() private view returns (BalanceSnapshot memory snapshot) {
        snapshot = BalanceSnapshot({
            totalActiveEscrow: escrow.totalActiveEscrow(),
            escrowBalance: usdc.balanceOf(address(escrow)),
            buyerBalance: usdc.balanceOf(BUYER),
            recipientOneBalance: usdc.balanceOf(RECIPIENT_ONE),
            recipientTwoBalance: usdc.balanceOf(RECIPIENT_TWO)
        });
    }

    function _assertBalancesUnchanged(BalanceSnapshot memory expected) private view {
        assertEq(escrow.totalActiveEscrow(), expected.totalActiveEscrow);
        assertEq(usdc.balanceOf(address(escrow)), expected.escrowBalance);
        assertEq(usdc.balanceOf(BUYER), expected.buyerBalance);
        assertEq(usdc.balanceOf(RECIPIENT_ONE), expected.recipientOneBalance);
        assertEq(usdc.balanceOf(RECIPIENT_TWO), expected.recipientTwoBalance);
    }

    function _assertOrderUnchanged(SettlementEscrow.Order memory expected, SettlementEscrow.Order memory actual)
        private
        pure
    {
        assertEq(actual.buyer, expected.buyer);
        assertEq(actual.totalAmount, expected.totalAmount);
        assertEq(actual.fundingDeadline, expected.fundingDeadline);
        assertEq(actual.settlementDeadline, expected.settlementDeadline);
        assertEq(actual.termsHash, expected.termsHash);
        assertEq(actual.createdAt, expected.createdAt);
        assertEq(actual.fundedAt, expected.fundedAt);
        assertEq(actual.disputedAt, expected.disputedAt);
        assertEq(actual.settledAt, expected.settledAt);
        assertEq(actual.refundedAt, expected.refundedAt);
        assertEq(actual.cancelledAt, expected.cancelledAt);
        assertEq(uint256(actual.status), uint256(expected.status));
    }
}
