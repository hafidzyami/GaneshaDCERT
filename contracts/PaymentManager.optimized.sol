// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract PaymentManager {
    error OrderAlreadyExists(bytes32 orderId);
    error OrderNotFound(bytes32 orderId);
    error OrderNotPending(bytes32 orderId);
    error InvalidAmount(uint256 amount);
    error EmptyItems();
    error ItemAlreadyExists(bytes32 itemId);
    error ItemNotFound(bytes32 itemId);
    error ItemAlreadyPaid(bytes32 itemId);
    error InvalidItemType(uint8 itemType);
    error EmptyVCHash();
    error PaymentAlreadyExists(bytes32 paymentId);
    error PaymentNotFound(bytes32 paymentId);
    error InvalidStatus(uint8 status);

    // Enums
    enum OrderStatus {
        NONE,
        PENDING_PAYMENT,
        SUCCESS,
        CANCELED
    }

    enum ItemType {
        ISSUANCE,
        RENEWAL,
        UPDATE
    }

    // Structs (Optimized for storage packing)
    struct Order {
        bytes32 holderDID;
        OrderStatus status;
        uint248 amount;
        bytes32 currency;
        uint40 createdAt;
        bytes32[] items;
    }

    struct Item {
        bytes32 issuerDID;
        bytes32 holderDID;
        uint248 price;
        bool isPaid;
        bytes32 vcID;
        bytes32 vcHash;
        ItemType itemType;
    }

    struct Payment {
        bytes32 orderID;
        bytes32 method;
        bytes32 status;
        uint248 amount;
        uint40 paidAt;
    }

    // State Variables
    mapping(bytes32 => Order) private orders;
    mapping(bytes32 => Item) private items;
    mapping(bytes32 => Payment) private payments;

    uint256 private ordersCount;
    uint256 private itemsCount;
    uint256 private paymentsCount;

    // Events
    event OrderCreated(
        bytes32 indexed id,
        bytes32 indexed holderDID,
        uint8 status,
        uint256 amount,
        bytes32 currency,
        uint256 timestamp
    );

    event OrderStatusChanged(
        bytes32 indexed id,
        uint8 oldStatus,
        uint8 newStatus,
        uint256 timestamp
    );

    event ItemCreated(
        bytes32 indexed id,
        bytes32 indexed vcID,
        bytes32 issuerDID,
        bytes32 holderDID,
        bytes32 vcHash,
        uint256 price,
        uint8 itemType,
        uint256 timestamp
    );

    event ItemPaid(
        bytes32 indexed id,
        bytes32 indexed vcID,
        uint256 timestamp
    );

    event PaymentCreated(
        bytes32 indexed id,
        bytes32 indexed orderID,
        bytes32 method,
        bytes32 status,
        uint256 amount,
        uint256 timestamp
    );

    event PaymentStatusChanged(
        bytes32 indexed id,
        bytes32 indexed orderID,
        bytes32 oldStatus,
        bytes32 newStatus,
        uint256 timestamp
    );

    event PaymentFailed(
        bytes32 indexed id,
        bytes32 indexed orderID,
        bytes32 method,
        uint256 amount,
        uint256 timestamp
    );

    event PaymentCompleted(
        bytes32 indexed id,
        bytes32 indexed orderID,
        bytes32 method,
        uint256 amount,
        uint256 timestamp
    );

    // Main Functions
    function createOrder(
        bytes32 _id,
        bytes32 _holderDID,
        uint248 _amount,
        bytes32 _currency,
        bytes32[] calldata _items
    ) external {
        if (orders[_id].status != OrderStatus.NONE) revert OrderAlreadyExists(_id);
        if (_amount == 0) revert InvalidAmount(_amount);
        if (_items.length == 0) revert EmptyItems();

        Order storage o = orders[_id];
        uint40 timestamp = uint40(block.timestamp);

        o.holderDID = _holderDID;
        o.status = OrderStatus.PENDING_PAYMENT;
        o.amount = _amount;
        o.currency = _currency;
        o.createdAt = timestamp;
        o.items = _items;

        unchecked {
            ordersCount++;
        }

        emit OrderCreated(_id, _holderDID, uint8(OrderStatus.PENDING_PAYMENT), _amount, _currency, timestamp);
    }

    function createItem(
        bytes32 _id,
        uint248 _price,
        bytes32 _vcID,
        bytes32 _issuerDID,
        bytes32 _holderDID,
        bytes32 _vcHash,
        uint8 _itemType
    ) external {
        if (items[_id].price != 0) revert ItemAlreadyExists(_id);
        if (_price == 0) revert InvalidAmount(_price);
        if (_vcHash == bytes32(0)) revert EmptyVCHash();
        if (_itemType > 2) revert InvalidItemType(_itemType);

        Item storage i = items[_id];
        uint40 timestamp = uint40(block.timestamp);

        i.issuerDID = _issuerDID;
        i.holderDID = _holderDID;
        i.price = _price;
        i.vcID = _vcID;
        i.vcHash = _vcHash;
        i.itemType = ItemType(_itemType);
        i.isPaid = false;

        unchecked {
            itemsCount++;
        }

        emit ItemCreated(_id, _vcID, _issuerDID, _holderDID, _vcHash, _price, _itemType, timestamp);
    }

    function createPayment(
        bytes32 _id,
        bytes32 _orderID,
        bytes32 _status,
        uint248 _amount
    ) external {
        if (payments[_id].orderID != bytes32(0)) revert PaymentAlreadyExists(_id);
        if (orders[_orderID].status == OrderStatus.NONE) revert OrderNotFound(_orderID);
        if (_amount == 0) revert InvalidAmount(_amount);

        Payment storage p = payments[_id];
        uint40 timestamp = uint40(block.timestamp);

        p.orderID = _orderID;
        p.status = _status;
        p.amount = _amount;
        p.paidAt = 0;

        unchecked {
            paymentsCount++;
        }

        emit PaymentCreated(_id, _orderID, bytes32(0), _status, _amount, timestamp);
    }

    function completePayment(
        bytes32 _paymentId,
        bytes32 _orderId,
        bytes32 _method,
        bytes32 _successStatus
    ) external {
        Payment storage p = payments[_paymentId];
        Order storage o = orders[_orderId];

        if (p.orderID == bytes32(0)) revert PaymentNotFound(_paymentId);
        if (o.status != OrderStatus.PENDING_PAYMENT) revert OrderNotPending(_orderId);

        bytes32 oldPaymentStatus = p.status;
        uint8 oldOrderStatus = uint8(o.status);
        uint40 timestamp = uint40(block.timestamp);

        p.status = _successStatus;
        p.method = _method;
        p.paidAt = timestamp;

        o.status = OrderStatus.SUCCESS;

        bytes32[] memory itemIds = o.items;
        uint256 length = itemIds.length;

        for (uint256 i = 0; i < length;) {
            Item storage item = items[itemIds[i]];
            if (!item.isPaid) {
                item.isPaid = true;
                emit ItemPaid(itemIds[i], item.vcID, timestamp);
            }
            unchecked { i++; }
        }

        emit PaymentStatusChanged(_paymentId, _orderId, oldPaymentStatus, _successStatus, timestamp);
        emit PaymentCompleted(_paymentId, _orderId, _method, p.amount, timestamp);
        emit OrderStatusChanged(_orderId, oldOrderStatus, uint8(OrderStatus.SUCCESS), timestamp);
    }

    function failedPayment(
        bytes32 _paymentId,
        bytes32 _orderId,
        bytes32 _method,
        bytes32 _failedStatus
    ) external {
        Payment storage p = payments[_paymentId];
        Order storage o = orders[_orderId];

        if (p.orderID == bytes32(0)) revert PaymentNotFound(_paymentId);
        if (o.status != OrderStatus.PENDING_PAYMENT) revert OrderNotPending(_orderId);

        bytes32 oldPaymentStatus = p.status;
        uint40 timestamp = uint40(block.timestamp);

        p.status = _failedStatus;
        p.method = _method;

        emit PaymentStatusChanged(_paymentId, _orderId, oldPaymentStatus, _failedStatus, timestamp);
        emit PaymentFailed(_paymentId, _orderId, _method, p.amount, timestamp);
    }

    function updateOrderStatus(bytes32 _id, uint8 _newStatus) external {
        Order storage o = orders[_id];

        if (o.status == OrderStatus.NONE) revert OrderNotFound(_id);
        if (_newStatus < 1 || _newStatus > 3) revert InvalidStatus(_newStatus);

        uint8 oldStatus = uint8(o.status);
        o.status = OrderStatus(_newStatus);

        emit OrderStatusChanged(_id, oldStatus, _newStatus, uint40(block.timestamp));
    }

    function markItemAsPaid(bytes32 _id) external {
        Item storage i = items[_id];

        if (i.price == 0) revert ItemNotFound(_id);
        if (i.isPaid) revert ItemAlreadyPaid(_id);

        i.isPaid = true;
        emit ItemPaid(_id, i.vcID, uint40(block.timestamp));
    }

    // View Functions
    function getOrder(bytes32 _id) external view returns (Order memory) {
        if (orders[_id].status == OrderStatus.NONE) revert OrderNotFound(_id);
        return orders[_id];
    }

    function getItem(bytes32 _id) external view returns (Item memory) {
        if (items[_id].price == 0) revert ItemNotFound(_id);
        return items[_id];
    }

    function getPayment(bytes32 _id) external view returns (Payment memory) {
        if (payments[_id].orderID == bytes32(0)) revert PaymentNotFound(_id);
        return payments[_id];
    }

    function getOrdersCount() external view returns (uint256) {
        return ordersCount;
    }

    function getItemsCount() external view returns (uint256) {
        return itemsCount;
    }

    function getPaymentsCount() external view returns (uint256) {
        return paymentsCount;
    }

    function getItemsByOrder(bytes32 orderId) external view returns (Item[] memory) {
        Order memory o = orders[orderId];
        if (o.status == OrderStatus.NONE) revert OrderNotFound(orderId);

        uint256 length = o.items.length;
        Item[] memory orderItems = new Item[](length);

        for (uint256 i = 0; i < length;) {
            orderItems[i] = items[o.items[i]];
            unchecked { i++; }
        }

        return orderItems;
    }

    function verifyVCHash(bytes32 _itemId, bytes32 _vcHash) external view returns (bool) {
        if (items[_itemId].price == 0) revert ItemNotFound(_itemId);
        return items[_itemId].vcHash == _vcHash;
    }

    function orderExists(bytes32 _id) external view returns (bool) {
        return orders[_id].status != OrderStatus.NONE;
    }

    function itemExists(bytes32 _id) external view returns (bool) {
        return items[_id].price != 0;
    }

    function paymentExists(bytes32 _id) external view returns (bool) {
        return payments[_id].orderID != bytes32(0);
    }
}
