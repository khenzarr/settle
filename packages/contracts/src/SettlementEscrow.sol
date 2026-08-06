// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title SettlementEscrow
/// @notice Stores marketplace orders and their settlement allocation data.
contract SettlementEscrow is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Role allowed to create marketplace orders.
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// @notice Role allowed to resolve disputed orders.
    bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");

    /// @notice Role allowed to pause and unpause settlement lifecycle operations.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Required total settlement share in basis points.
    uint256 public constant TOTAL_BASIS_POINTS = 10_000;

    /// @notice Maximum number of settlement recipients for one order.
    uint256 public constant MAX_RECIPIENTS = 8;

    /// @notice Six-decimal settlement token held and paid by this escrow.
    IERC20 public immutable usdc;

    /// @notice Sum of funded order amounts that have not reached a terminal state.
    uint256 public totalActiveEscrow;

    /// @notice Order lifecycle states.
    enum OrderStatus {
        None,
        Created,
        Funded,
        Disputed,
        Completed,
        Refunded,
        Cancelled
    }

    /// @notice The only permitted outcomes for a disputed order.
    enum DisputeResolution {
        Release,
        Refund
    }

    /// @notice Fixed information stored for an order.
    struct Order {
        address buyer;
        uint256 totalAmount;
        uint256 fundingDeadline;
        uint256 settlementDeadline;
        bytes32 termsHash;
        uint256 createdAt;
        uint256 fundedAt;
        uint256 disputedAt;
        uint256 settledAt;
        uint256 refundedAt;
        uint256 cancelledAt;
        OrderStatus status;
    }

    error ZeroAddress();
    error InvalidTokenDecimals(uint8 actualDecimals);
    error ZeroOrderId();
    error OrderAlreadyExists(bytes32 orderId);
    error OrderNotFound(bytes32 orderId);
    error ZeroBuyer();
    error ZeroAmount();
    error InvalidFundingDeadline();
    error InvalidSettlementDeadline();
    error ZeroTermsHash();
    error InvalidRecipientCount(uint256 count);
    error SettlementArrayLengthMismatch();
    error ZeroRecipient(uint256 index);
    error DuplicateRecipient(address recipient);
    error ZeroShare(uint256 index);
    error InvalidTotalShares(uint256 totalShares);
    error InvalidOrderStatus(OrderStatus actualStatus);
    error CallerNotBuyer(address caller);
    error UnauthorizedDisputeCaller(address caller);
    error UnauthorizedReleaseCaller(address caller);
    error FundingDeadlinePassed(uint256 fundingDeadline);
    error FundingDeadlineNotReached(uint256 fundingDeadline);
    error IncorrectReceivedAmount(uint256 expectedAmount, uint256 receivedAmount);

    /// @notice Emitted when an operator creates an order.
    event OrderCreated(
        bytes32 indexed orderId,
        address indexed buyer,
        uint256 totalAmount,
        uint256 fundingDeadline,
        uint256 settlementDeadline,
        bytes32 termsHash
    );

    /// @notice Emitted when the declared buyer funds an order.
    event OrderFunded(bytes32 indexed orderId, address indexed buyer, uint256 fundedAmount, uint256 fundedAt);

    /// @notice Emitted when a buyer or operator disputes a funded order.
    event OrderDisputed(bytes32 indexed orderId, address indexed caller, address indexed buyer, uint256 disputedAt);

    /// @notice Emitted when a funded order is fully released to its settlement recipients.
    event OrderReleased(bytes32 indexed orderId, address indexed buyer, uint256 totalAmount, uint256 settledAt);

    /// @notice Emitted when an operator refunds a funded order to its buyer.
    event OrderRefunded(bytes32 indexed orderId, address indexed buyer, uint256 refundedAmount, uint256 refundedAt);

    /// @notice Emitted when an expired, unfunded order is cancelled.
    event OrderCancelled(bytes32 indexed orderId, address indexed caller, address indexed buyer, uint256 cancelledAt);

    /// @notice Emitted for each recipient payment made during an order release.
    event SettlementPaid(bytes32 indexed orderId, address indexed recipient, uint256 recipientAmount);

    /// @notice Emitted when an arbitrator resolves a disputed order.
    event DisputeResolved(
        bytes32 indexed orderId,
        address indexed arbitrator,
        DisputeResolution resolution,
        uint256 amount,
        uint256 resolvedAt
    );

    mapping(bytes32 orderId => Order order) private _orders;
    mapping(bytes32 orderId => address[] recipients) private _settlementRecipients;
    mapping(bytes32 orderId => uint16[] shares) private _settlementShares;

    /// @notice Initializes the escrow with its token and initial roles.
    /// @param usdcToken Address of a six-decimal USDC-compatible token.
    /// @param initialAdministrator Address receiving the default administrator role.
    /// @param initialOperator Address receiving the operator role.
    /// @param initialArbitrator Address receiving the arbitrator role.
    /// @param initialPauser Address receiving the pauser role.
    constructor(
        address usdcToken,
        address initialAdministrator,
        address initialOperator,
        address initialArbitrator,
        address initialPauser
    ) {
        if (
            usdcToken == address(0) || initialAdministrator == address(0) || initialOperator == address(0)
                || initialArbitrator == address(0) || initialPauser == address(0)
        ) {
            revert ZeroAddress();
        }

        uint8 tokenDecimals = IERC20Metadata(usdcToken).decimals();
        if (tokenDecimals != 6) revert InvalidTokenDecimals(tokenDecimals);

        usdc = IERC20(usdcToken);
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdministrator);
        _grantRole(OPERATOR_ROLE, initialOperator);
        _grantRole(ARBITRATOR_ROLE, initialArbitrator);
        _grantRole(PAUSER_ROLE, initialPauser);
    }

    /// @notice Pauses all settlement lifecycle operations.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Unpauses all settlement lifecycle operations.
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @notice Creates an order and its immutable settlement allocation.
    /// @param orderId Caller-selected unique identifier for the order.
    /// @param buyer Address responsible for funding the order.
    /// @param totalAmount Total order amount in USDC base units.
    /// @param fundingDeadline Latest timestamp at which funding will be accepted.
    /// @param settlementDeadline Timestamp after the funding deadline for settlement completion.
    /// @param termsHash Hash of the offchain order terms.
    /// @param recipients Settlement recipient addresses.
    /// @param shares Settlement shares in basis points, aligned by index with recipients.
    function createOrder(
        bytes32 orderId,
        address buyer,
        uint256 totalAmount,
        uint256 fundingDeadline,
        uint256 settlementDeadline,
        bytes32 termsHash,
        address[] calldata recipients,
        uint16[] calldata shares
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        if (orderId == bytes32(0)) revert ZeroOrderId();
        if (_orders[orderId].status != OrderStatus.None) revert OrderAlreadyExists(orderId);
        if (buyer == address(0)) revert ZeroBuyer();
        if (totalAmount == 0) revert ZeroAmount();
        if (fundingDeadline <= block.timestamp) revert InvalidFundingDeadline();
        if (settlementDeadline <= fundingDeadline) revert InvalidSettlementDeadline();
        if (termsHash == bytes32(0)) revert ZeroTermsHash();

        _validateSettlementSplits(recipients, shares);

        _orders[orderId] = Order({
            buyer: buyer,
            totalAmount: totalAmount,
            fundingDeadline: fundingDeadline,
            settlementDeadline: settlementDeadline,
            termsHash: termsHash,
            createdAt: block.timestamp,
            fundedAt: 0,
            disputedAt: 0,
            settledAt: 0,
            refundedAt: 0,
            cancelledAt: 0,
            status: OrderStatus.Created
        });

        for (uint256 i = 0; i < recipients.length; ++i) {
            _settlementRecipients[orderId].push(recipients[i]);
            _settlementShares[orderId].push(shares[i]);
        }

        emit OrderCreated(orderId, buyer, totalAmount, fundingDeadline, settlementDeadline, termsHash);
    }

    /// @notice Funds an existing order with its exact configured USDC amount.
    /// @param orderId Identifier of the order to fund.
    function fundOrder(bytes32 orderId) external whenNotPaused nonReentrant {
        Order storage order = _orders[orderId];
        if (order.status == OrderStatus.None) revert OrderNotFound(orderId);
        if (order.status != OrderStatus.Created) revert InvalidOrderStatus(order.status);
        if (msg.sender != order.buyer) revert CallerNotBuyer(msg.sender);
        if (block.timestamp >= order.fundingDeadline) revert FundingDeadlinePassed(order.fundingDeadline);

        uint256 fundedAt = block.timestamp;
        order.status = OrderStatus.Funded;
        order.fundedAt = fundedAt;
        totalActiveEscrow += order.totalAmount;

        uint256 balanceBefore = usdc.balanceOf(address(this));
        usdc.safeTransferFrom(msg.sender, address(this), order.totalAmount);
        uint256 balanceAfter = usdc.balanceOf(address(this));
        uint256 receivedAmount = balanceAfter >= balanceBefore ? balanceAfter - balanceBefore : 0;
        if (receivedAmount != order.totalAmount) {
            revert IncorrectReceivedAmount(order.totalAmount, receivedAmount);
        }

        emit OrderFunded(orderId, msg.sender, order.totalAmount, fundedAt);
    }

    /// @notice Cancels an unfunded order once its funding deadline has been reached.
    /// @param orderId Identifier of the expired order to cancel.
    function cancelExpiredOrder(bytes32 orderId) external whenNotPaused {
        Order storage order = _orders[orderId];
        if (order.status == OrderStatus.None) revert OrderNotFound(orderId);
        if (order.status != OrderStatus.Created) revert InvalidOrderStatus(order.status);
        if (block.timestamp < order.fundingDeadline) revert FundingDeadlineNotReached(order.fundingDeadline);

        uint256 cancelledAt = block.timestamp;
        order.status = OrderStatus.Cancelled;
        order.cancelledAt = cancelledAt;

        emit OrderCancelled(orderId, msg.sender, order.buyer, cancelledAt);
    }

    /// @notice Places a funded order into dispute without moving its escrowed funds.
    /// @param orderId Identifier of the funded order to dispute.
    function raiseDispute(bytes32 orderId) external whenNotPaused {
        Order storage order = _orders[orderId];
        if (order.status == OrderStatus.None) revert OrderNotFound(orderId);
        if (order.status != OrderStatus.Funded) revert InvalidOrderStatus(order.status);
        if (msg.sender != order.buyer && !hasRole(OPERATOR_ROLE, msg.sender)) {
            revert UnauthorizedDisputeCaller(msg.sender);
        }

        uint256 disputedAt = block.timestamp;
        order.status = OrderStatus.Disputed;
        order.disputedAt = disputedAt;

        emit OrderDisputed(orderId, msg.sender, order.buyer, disputedAt);
    }

    /// @notice Releases a funded order's full amount to its configured settlement recipients.
    /// @param orderId Identifier of the funded order to release.
    function releaseOrder(bytes32 orderId) external whenNotPaused nonReentrant {
        Order storage order = _orders[orderId];
        if (order.status == OrderStatus.None) revert OrderNotFound(orderId);
        if (order.status != OrderStatus.Funded) revert InvalidOrderStatus(order.status);
        if (msg.sender != order.buyer && !hasRole(OPERATOR_ROLE, msg.sender)) {
            revert UnauthorizedReleaseCaller(msg.sender);
        }

        _releaseOrder(orderId, order);
    }

    /// @notice Refunds a funded order's full amount to its original buyer.
    /// @param orderId Identifier of the funded order to refund.
    function refundOrder(bytes32 orderId) external onlyRole(OPERATOR_ROLE) whenNotPaused nonReentrant {
        Order storage order = _orders[orderId];
        if (order.status == OrderStatus.None) revert OrderNotFound(orderId);
        if (order.status != OrderStatus.Funded) revert InvalidOrderStatus(order.status);

        _refundOrder(orderId, order);
    }

    /// @notice Resolves a disputed order by releasing it or refunding its buyer.
    /// @param orderId Identifier of the disputed order.
    /// @param resolution The typed, permitted resolution outcome.
    function resolveDispute(bytes32 orderId, DisputeResolution resolution)
        external
        onlyRole(ARBITRATOR_ROLE)
        whenNotPaused
        nonReentrant
    {
        Order storage order = _orders[orderId];
        if (order.status == OrderStatus.None) revert OrderNotFound(orderId);
        if (order.status != OrderStatus.Disputed) revert InvalidOrderStatus(order.status);

        uint256 amount = order.totalAmount;
        uint256 resolvedAt = block.timestamp;
        if (resolution == DisputeResolution.Release) {
            _releaseOrder(orderId, order);
        } else {
            _refundOrder(orderId, order);
        }

        emit DisputeResolved(orderId, msg.sender, resolution, amount, resolvedAt);
    }

    /// @notice Returns all fixed information stored for an order.
    /// @param orderId Identifier of the order to read.
    /// @return order Complete fixed order information.
    function getOrder(bytes32 orderId) external view returns (Order memory order) {
        order = _orders[orderId];
        if (order.status == OrderStatus.None) revert OrderNotFound(orderId);
    }

    /// @notice Returns settlement recipients and their corresponding basis-point shares.
    /// @param orderId Identifier of the order to read.
    /// @return recipients Settlement recipient addresses.
    /// @return shares Basis-point shares aligned by index with recipients.
    function getSettlementSplits(bytes32 orderId)
        external
        view
        returns (address[] memory recipients, uint16[] memory shares)
    {
        if (_orders[orderId].status == OrderStatus.None) revert OrderNotFound(orderId);
        return (_settlementRecipients[orderId], _settlementShares[orderId]);
    }

    /// @notice Reports whether an order identifier has already been used.
    /// @param orderId Identifier to check.
    /// @return True when an order exists for the identifier.
    function orderExists(bytes32 orderId) external view returns (bool) {
        return _orders[orderId].status != OrderStatus.None;
    }

    function _validateSettlementSplits(address[] calldata recipients, uint16[] calldata shares) private pure {
        uint256 recipientCount = recipients.length;
        if (recipientCount == 0 || recipientCount > MAX_RECIPIENTS) {
            revert InvalidRecipientCount(recipientCount);
        }
        if (recipientCount != shares.length) revert SettlementArrayLengthMismatch();

        uint256 totalShares;
        for (uint256 i = 0; i < recipientCount; ++i) {
            address recipient = recipients[i];
            if (recipient == address(0)) revert ZeroRecipient(i);
            if (shares[i] == 0) revert ZeroShare(i);

            for (uint256 j = 0; j < i; ++j) {
                if (recipients[j] == recipient) revert DuplicateRecipient(recipient);
            }

            totalShares += shares[i];
        }

        if (totalShares != TOTAL_BASIS_POINTS) revert InvalidTotalShares(totalShares);
    }

    function _releaseOrder(bytes32 orderId, Order storage order) private {
        uint256 totalAmount = order.totalAmount;
        uint256 settledAt = block.timestamp;
        order.status = OrderStatus.Completed;
        order.settledAt = settledAt;
        totalActiveEscrow -= totalAmount;

        address[] storage recipients = _settlementRecipients[orderId];
        uint16[] storage shares = _settlementShares[orderId];
        uint256 amountDistributed;
        uint256 finalRecipientIndex = recipients.length - 1;

        for (uint256 i = 0; i < finalRecipientIndex; ++i) {
            uint256 recipientAmount = totalAmount * shares[i] / TOTAL_BASIS_POINTS;
            amountDistributed += recipientAmount;
            usdc.safeTransfer(recipients[i], recipientAmount);
            emit SettlementPaid(orderId, recipients[i], recipientAmount);
        }

        uint256 remainingAmount = totalAmount - amountDistributed;
        usdc.safeTransfer(recipients[finalRecipientIndex], remainingAmount);
        emit SettlementPaid(orderId, recipients[finalRecipientIndex], remainingAmount);
        emit OrderReleased(orderId, order.buyer, totalAmount, settledAt);
    }

    function _refundOrder(bytes32 orderId, Order storage order) private {
        address buyer = order.buyer;
        uint256 totalAmount = order.totalAmount;
        uint256 refundedAt = block.timestamp;
        order.status = OrderStatus.Refunded;
        order.refundedAt = refundedAt;
        totalActiveEscrow -= totalAmount;

        usdc.safeTransfer(buyer, totalAmount);

        emit OrderRefunded(orderId, buyer, totalAmount, refundedAt);
    }
}
