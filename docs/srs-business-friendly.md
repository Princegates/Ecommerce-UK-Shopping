## 1. Executive Summary

SHOP UK FROM GH will be an online platform that allows customers in Ghana to shop for products sold by UK shops and have those products delivered to Ghana.

The website will provide a simple way for a customer to find a product, understand the estimated total cost, pay online, and track the order until delivery.

The business will handle the UK purchase, receiving the item at a UK address, shipping it to Ghana, customs processing, and local delivery.

The basic journey is:

- Customer finds a product → Customer sees the total cost → Customer pays → SHOP UK FROM GH purchases the product in the UK → Product arrives at the UK receiving address → Product ships to Ghana → Customs process → Local delivery → Customer receives product.

## 2. Purpose of the System

The system is intended to create one central platform for managing the complete shopping and delivery process between UK retailers and customers in Ghana.

- Make UK shopping easier for customers in Ghana.
- Show customers the major charges before they pay.
- Allow customers to buy from listed UK shops or submit a product link.
- Manage orders from payment through final delivery.
- Allow staff to manage purchases, shipping, delivery and customer communication.
- Give management visibility into sales, costs and profitability.

## 3. Business Model

The platform will act as the customer's shopping and delivery intermediary. Customers can browse products already listed on the platform or provide a link to a product on an approved UK shop.

The customer pays through the platform. After confirmed payment, staff purchase the item from the UK shop, receive it at the company's UK address, ship it to Ghana, process the relevant customs stage, and arrange Ghana delivery.

## 4. Who Will Use the System?

- Customers – browse, order, pay, track deliveries and manage their accounts.
- Visitors – browse the website and products without signing in.
- Staff – process orders, purchases, shipping, customer requests and deliveries.
- Super Admin – controls pricing, staff access, shops, shipping, delivery areas and system settings.

## 5. Customer Website

The website should be easy to understand and usable on phones, tablets and computers.

- Homepage and product browsing.
- Search and product categories.
- UK shop listings.
- Product details and pricing.
- Deals/promotions where available.
- Shopping cart.
- Customer account.
- Order tracking.
- Help/contact information.
- Link-to-product shopping option.

## 6. Product and Shop Catalogue

Customers should be able to browse products available from approved UK shops.

- Shop name and information.
- Product name and image.
- UK price in pounds (£).
- Product details where available.
- Availability/status.
- Current deals where applicable.
- Product link/source.
- Customer reviews where applicable.

## 7. Buy From Any UK Shop – Paste a Link

Customers should not be limited to products already listed in the catalogue. A customer can paste a product link from an approved UK shop.

The system attempts to read the product name and UK price. The customer can then specify quantity, size, colour or other available options.

Before the order is created, the server re-checks the product information and applies the relevant pricing rules.

If the system cannot safely read the product, or the request exceeds the automatic quotation limit, it should be referred to staff for review and quotation.

## 8. Customer Account

- Registration and sign-in.
- Saved delivery addresses.
- Order history.
- Order tracking.
- Wishlist.
- Reviews for eligible delivered items.
- Password recovery.
- Customer notification preferences.
- Personal information management.

## 9. Shopping Cart

The cart should clearly show what the customer is buying and the expected charges.

- Product name and quantity.
- UK price.
- Service charge.
- Shipping to Ghana.
- Ghana delivery fee.
- Estimated total in Ghana cedis and relevant UK-pound values.
- Ability to change quantity or remove an item.

## 10. Pricing

The customer's total is based on the product cost plus the applicable service, international shipping and Ghana delivery charges.

Import duties and taxes are excluded from the customer total unless the business specifically decides otherwise.

The system should calculate pricing consistently so customers and staff are working from the same figures.

## 11. Currency Conversion

UK product prices are stored in pounds (£). The system converts the UK price into Ghana cedis using the exchange rate configured by the business.

The effective rate is the configured exchange rate plus any configured exchange-rate markup.

## 12. Service Charge

The business can configure a service charge. The charge should be included in the amount the customer sees before payment.

## 13. Shipping From the UK to Ghana

The system should support shipping rate cards. Shipping charges can be based on the relevant shipping method and chargeable weight.

The business should be able to configure the available shipping methods and their rates.

## 14. Ghana Delivery

The system should support delivery areas in Ghana, with a delivery fee for each area.

The customer selects the appropriate delivery area and address during checkout.

## 15. Minimum Order

A minimum product-value requirement may apply. The default minimum is £10 and it also applies to link-based orders.

## 16. Checkout

- Review cart and total.
- Sign in or register.
- Select delivery area and shipping option.
- Enter/select delivery address.
- Choose notification preferences.
- Review the final amount.
- Proceed to payment.

## 17. Online Payments

The order is considered paid only when the payment gateway confirms the payment and the amount and currency match the order.

Staff should not be able to manually mark an order as paid. This protects the business against payment mismatches and fraudulent confirmation.

## 18. Order Process

The customer should be able to see the order move through clear stages:

- Payment received.
- Buying from UK shop.
- Bought from UK shop.
- Received at UK address.
- On its way to Ghana.
- Clearing customs.
- Out for delivery.
- Delivered.

## 19. Order Tracking

Customers should be able to track the current order stage from their account and through relevant tracking information.

Where available, UK tracking, Ghana shipping tracking and courier references should be recorded against the order.

## 20. Purchasing Rule

The business must not purchase a product before confirmed payment has been received.

Once staff begin purchasing, the order should show that the UK purchasing process has started. Retailer references and relevant purchase information should be recorded.

## 21. Order Cost and Profit Tracking

Staff should be able to record actual costs associated with an order so management can understand the financial result.

- Product purchase cost.
- Shipping cost.
- Delivery cost.
- Other recorded costs.
- Customer amount paid.
- Estimated or actual margin.

## 22. Cancellation and Refunds

Customers can normally cancel before the business purchases the product from the UK shop.

For a paid cancellation, the order can move to a refund-required stage. Staff then process the refund through the payment gateway and record the order as refunded.

## 23. Receipts and Invoices

The system should provide order documentation showing what the customer purchased and the charges associated with the order. Downloadable receipts/invoices are identified as a future enhancement in the source requirements.

## 24. Customer Notifications

Customers should receive notifications for important order events through channels they have selected, provided those channels are enabled by the business and supported by the relevant service provider.

## 25. Customer Reviews

Customers may review delivered products. A review can only be submitted for an item that has been delivered, and normally only once per item.

## 26. Wishlist

Customers should be able to save products they are interested in for later consideration.

## 27. Product Catalogue Management

Staff and administrators should be able to manage products and shops shown on the platform.

- Add or update products.
- Manage shop information.
- Control product visibility.
- Review unusual imported products.
- Manage deals/promotions.
- Remove or hold products when required.

## 28. Automatic Product Import

The platform may automatically import products from approved UK shop sources where the business has permission to do so.

The importer should bring in product information such as name, price, link and available product details, subject to the source's permitted data.

## 29. Important Rule for Product Importing

The system must not attempt to bypass retailer security or restrictions.

- Sources requiring login or blocked access should not be bypassed.
- If a source returns a refusal or restriction such as 401, 403, 429 or 451, importing pauses for 24 hours.
- Verification/challenge pages should cause the source to pause.
- Imported prices must be in pounds.
- Unusual prices, large price jumps, very short names or missing links should be held for review.
- Products that become stale should eventually be hidden.

## 30. Product Review Queue

Products that look unusual or unsafe to publish automatically should go into a review queue for staff.

Staff can review, correct, approve, hold or reject the product before it becomes visible to customers.

## 31. Administration Dashboard

The administration area should provide a clear overview of the business and the work that needs attention.

- Orders and their current stages.
- Pending customer requests.
- Products awaiting review.
- Shipping and delivery settings.
- Pricing settings.
- Staff accounts.
- Customer-related activity.
- Business performance information.

## 32. Needs Attention Dashboard

The system should highlight items that require staff action, such as new link requests, payment-related issues, products waiting for review, orders awaiting the next step, failed notifications or other operational exceptions.

## 33. Pricing Management

Authorized administrators should be able to configure the business pricing model.

- Exchange rate.
- Exchange-rate markup.
- Service charge.
- Minimum order amount.
- Shipping rates.
- Delivery charges.
- Relevant quotation settings.

## 34. Shipping Management

Administrators should be able to create and maintain shipping rate cards and shipping methods used by the platform.

## 35. Delivery Area Management

Administrators should be able to create and manage Ghana delivery areas and their charges.

The system must prevent deletion of the last active delivery area.

## 36. Staff Management

Only the Super Admin should create staff accounts or assign staff rights.

- Create staff accounts.
- Assign roles/rights.
- Change permissions.
- Reset accounts.
- Disable accounts.
- Immediately sign out affected users when an account is disabled or changed where required.

## 37. Security and Access Control

The system should protect customer and business information.

- Passwords and sensitive access information must be protected.
- Access should be based on user roles and permissions.
- Important staff actions should be recorded in an audit log.
- Customer personal data should be limited to what is needed.
- Account recovery links should expire.
- Disabling or changing an account should remove its access promptly.

## 38. Mobile Friendliness

The customer-facing website should work well on smartphones because many Ghanaian customers are expected to access the service through mobile devices.

## 39. Website Performance

The platform should respond quickly enough for normal browsing, checkout and order-management activities. The planned operating scale is approximately 5,000 catalogue items, 500 orders per day and 50,000 customers.

## 40. Backup and Recovery

Business information must be protected against accidental loss. The system uses persistent business data and should have an appropriate backup and recovery process.

## 41. Data Management

- Orders should retain the customer, delivery, shipping, rates and product information that applied when the order was placed.
- Money should be stored accurately without rounding problems.
- Important times should be stored consistently.
- Audit records should be append-only.
- Customer data should be exportable when requested.
- The system should retain records until the operator removes them; there is no automatic deletion requirement in the source specification.

## 42. Third-Party Services

The platform may connect to payment gateways, messaging services, shipping/tracking services, exchange-rate sources and other external services. These integrations should be controlled by administrators and recorded where appropriate.

## 43. What the Software Does Not Do

The software supports business operations but does not itself provide legal compliance.

- The business remains responsible for consumer-protection obligations.
- The business remains responsible for VAT, import duties and taxes.
- The business remains responsible for payment-service licensing requirements.
- The business remains responsible for data-protection compliance.
- The business must ensure lawful use of product information and images.
- Customs and regulatory decisions remain the responsibility of the relevant business/operator and authorities.

## 44. Important Business Rules

- Customer total = product cost + service charge + UK-to-Ghana shipping + Ghana delivery.
- Duties/taxes are excluded unless otherwise configured.
- Only confirmed gateway payments count as paid.
- Nothing is purchased before confirmed payment.
- Staff normally move an order one step forward through its process.
- Cancellation is normally allowed before UK purchase.
- A review is allowed only for a delivered item and once per item.
- A deal is live only while the current price is below the original/was price and the deal has not expired.
- A quotation is valid for a defined period, normally 3 days unless configured otherwise.
- A quote link is private, can be edited until used, and can normally be used for one order.

## 45. Main Customer Journey

- Browse or search.
- Select product.
- Add to cart.
- Review total.
- Sign in/register.
- Select shipping and delivery.
- Enter address.
- Pay.
- Payment confirmed.
- Order begins processing.
- Customer receives updates.
- Customer tracks order.
- Customer receives delivery.

## 46. Main Link-Order Journey

- Customer pastes UK product link.
- System attempts to read the product.
- Customer specifies options/quantity.
- System re-checks information and pricing.
- System generates a quote or sends the request to staff.
- Customer signs in.
- Customer selects delivery and shipping.
- Customer pays.
- Request becomes an order.
- Staff purchases the item.
- Normal delivery process continues.

## 47. Main Staff Order Process

- Review paid order.
- Purchase from UK retailer.
- Record retailer reference.
- Record UK tracking.
- Confirm receipt at UK address.
- Ship toward Ghana.
- Record shipping/tracking information.
- Process customs stage.
- Arrange Ghana delivery.
- Record delivery/courier reference.
- Mark delivered.
- Record actual costs and margin.

## 48. Business Reporting

Management should be able to understand key business activity from the system.

- Orders and sales.
- Amounts collected.
- Product and shipping costs.
- Delivery costs.
- Refunds.
- Outstanding operational tasks.
- Estimated/actual margins.
- Order volumes and customer activity.

## 49. Legal and Regulatory Responsibility

The software is an operational tool. The business owner/operator remains responsible for ensuring the service complies with applicable laws, regulations, contracts and retailer requirements.

## 50. Key Risks and Controls

- Retailer blocking or changing access – use only permitted sources and pause restricted imports.
- Incorrect product price – re-check prices before order creation/purchase.
- Exchange-rate movement – use configured rates and recalculate at order creation.
- Data loss – maintain backups and recovery procedures.
- Secret/password exposure – protect credentials and access.
- Payment mismatch or fraud – accept only gateway-confirmed matching payments.
- Staff misuse – use role-based permissions and audit records.
- Customs/VAT/consumer-law issues – business remains responsible for compliance.
- Third-party changes – monitor integrations and import sources.

## 51. Future Enhancements

- Two-factor authentication for staff and Super Admin.
- Phone/email verification.
- Automatic final price verification at purchase.
- Admin refunds directly through payment gateway.
- Customer self-service cancellation.
- Downloadable receipts/invoices.
- Email staff invitations.
- Stronger website security controls.
- Scalable shared worker/rate-limit infrastructure.
- Privacy data-export and retention tools.
- Formal WCAG accessibility audit.
- Load testing and real-device/browser testing.
- Volumetric-weight shipping.
- Multiple languages.
- Returns and disputes management.
- Inventory/stock-count features.

## 52. Success Criteria

The system will be considered successful when customers can easily discover or request UK products, understand the expected charges, make a confirmed payment, and track the order through to delivery in Ghana.

The business should also be able to manage products, orders, staff, pricing, shipping, delivery areas and customer communication from one central platform.

## 53. Final System Vision

SHOP UK FROM GH should feel like a trusted bridge between UK online shopping and customers in Ghana.

The customer should not need to understand the technical process behind purchasing, forwarding, shipping or delivery. The platform should make the journey simple, transparent and trackable.

The central business promise is: **Find it in the UK. Pay in Ghana. We handle the journey to your door.**

## 54. Document Control

- Document: Software Requirements Specification – SHOP UK FROM GH
- Version: 1.0
- Date: 7 October 2026
- Document type: Business-friendly requirements version
- Primary Market: Ghana
- Shopping Source: United Kingdom
- Prepared for: SHOP UK FROM GH
- Technology Partner: Anknovate IT Consultancy Services
