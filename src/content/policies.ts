/**
 * Legal pages carried over word-for-word from the previous WordPress site (last updated November 2025).
 * Source: the old site's Shipping/Return/Refund, Privacy and Terms pages (archived in data/wordpress-archive).
 * Do not paraphrase legal text without the owner's approval.
 */
export type PolicyBlock = { kind: "h" | "p" | "li"; text: string };
export interface PolicyDoc {
  title: string;
  oldPath: string;
  blocks: PolicyBlock[];
}

export const policies: Record<string, PolicyDoc> = {
  "shipping-return-refund": {
    "title": "Shipping, Return & Refund Policy",
    "oldPath": "/shipping-return-refund-policy/",
    "blocks": [
      {
        "kind": "p",
        "text": "Last Updated: November 2025"
      },
      {
        "kind": "p",
        "text": "Thank you for shopping at Sindhu’s Pickles."
      },
      {
        "kind": "p",
        "text": "We aim to deliver fresh, homemade non-vegetarian pickles and food products safely and on time."
      },
      {
        "kind": "p",
        "text": "Please read our Shipping, Return, and Refund Policy carefully before placing your order."
      },
      {
        "kind": "h",
        "text": "1. Shipping Policy"
      },
      {
        "kind": "p",
        "text": "Processing Time"
      },
      {
        "kind": "li",
        "text": "Orders are processed within 2–3 business days after payment confirmation."
      },
      {
        "kind": "li",
        "text": "We prepare each batch fresh to maintain quality, so minor delays may occur during peak seasons or festivals."
      },
      {
        "kind": "li",
        "text": "Orders placed on weekends or public holidays will be processed on the next working day."
      },
      {
        "kind": "p",
        "text": "Shipping Charges"
      },
      {
        "kind": "li",
        "text": "Shipping fees are calculated automatically at checkout based on your order weight and delivery location."
      },
      {
        "kind": "li",
        "text": "Any applicable delivery charges or offers (like free shipping) will be displayed before you complete payment."
      },
      {
        "kind": "p",
        "text": "Delivery Time"
      },
      {
        "kind": "li",
        "text": "Estimated delivery time is 3–5 business days after dispatch, depending on your location."
      },
      {
        "kind": "li",
        "text": "Rural or remote areas may take slightly longer."
      },
      {
        "kind": "li",
        "text": "We partner with reliable courier services to ensure timely delivery, but delays due to logistics or natural events are beyond our control."
      },
      {
        "kind": "p",
        "text": "Order Tracking"
      },
      {
        "kind": "li",
        "text": "Once your order is shipped, you will receive an email and/or SMS with your tracking ID and courier details."
      },
      {
        "kind": "li",
        "text": "You can track your shipment status through the provided link."
      },
      {
        "kind": "h",
        "text": "2. Return and Replacement Policy"
      },
      {
        "kind": "p",
        "text": "No Returns or Exchanges"
      },
      {
        "kind": "li",
        "text": "Due to the perishable nature of our food products, we do not accept returns or exchanges once an order is delivered."
      },
      {
        "kind": "li",
        "text": "Please review your order details carefully before confirming your purchase."
      },
      {
        "kind": "p",
        "text": "Damaged or Incorrect Products"
      },
      {
        "kind": "li",
        "text": "We take the utmost care to package every pickle jar securely."
      },
      {
        "kind": "li",
        "text": "However, if your order arrives damaged, leaked, or incorrect, please contact us within 24 hours of delivery."
      },
      {
        "kind": "li",
        "text": "Send the following details to info@sindhuspickles.com:"
      },
      {
        "kind": "li",
        "text": "Your order number"
      },
      {
        "kind": "li",
        "text": "Photos or videos clearly showing the damaged/incorrect items"
      },
      {
        "kind": "li",
        "text": "A brief description of the issue"
      },
      {
        "kind": "p",
        "text": "Our quality team will investigate and, if the issue is verified, we’ll offer a replacement or refund at our discretion."
      },
      {
        "kind": "h",
        "text": "3. Refund Policy"
      },
      {
        "kind": "p",
        "text": "Refund Eligibility"
      },
      {
        "kind": "p",
        "text": "Refunds are applicable only in the following cases:"
      },
      {
        "kind": "li",
        "text": "Non-delivery of order (verified through courier tracking)"
      },
      {
        "kind": "li",
        "text": "Damaged or incorrect product (after investigation and proof)"
      },
      {
        "kind": "p",
        "text": "We do not issue refunds for:"
      },
      {
        "kind": "li",
        "text": "Customer mistakes in address entry or order confirmation"
      },
      {
        "kind": "li",
        "text": "Dislike of taste, texture, or personal preferences"
      },
      {
        "kind": "li",
        "text": "Products returned without prior communication or approval"
      },
      {
        "kind": "p",
        "text": "Refund Process"
      },
      {
        "kind": "li",
        "text": "Once approved, refunds will be initiated within 5 business days."
      },
      {
        "kind": "li",
        "text": "The amount will be credited to your original payment method (Razorpay, Paytm, UPI, Card, or Net Banking)."
      },
      {
        "kind": "li",
        "text": "You will receive an email notification once your refund is processed."
      },
      {
        "kind": "h",
        "text": "4. Cancellation Policy"
      },
      {
        "kind": "li",
        "text": "Orders can be canceled within 6 hours of placing the order by emailing info@sindhuspickles.com."
      },
      {
        "kind": "li",
        "text": "Once the product is shipped or processed, cancellations are not possible."
      },
      {
        "kind": "li",
        "text": "If a payment was made and the order is canceled in time, a full refund will be issued within 5 business days."
      },
      {
        "kind": "h",
        "text": "5. Responsibility & Disclaimer"
      },
      {
        "kind": "li",
        "text": "We ensure hygienic preparation, packaging, and dispatch of all non-veg pickles."
      },
      {
        "kind": "li",
        "text": "Sindhu’s Pickles is not responsible for delays caused by courier partners, incorrect shipping details, or unforeseen natural events."
      },
      {
        "kind": "li",
        "text": "Please store pickles as per instructions on the label for best quality and shelf life."
      },
      {
        "kind": "h",
        "text": "6. Contact Us"
      },
      {
        "kind": "p",
        "text": "If you have any questions regarding shipping, replacement, or refunds, please reach out to us:"
      },
      {
        "kind": "p",
        "text": "Sindhu’s Pickles"
      },
      {
        "kind": "p",
        "text": "📧 Email: info@sindhuspickles.com"
      },
      {
        "kind": "p",
        "text": "📞 Phone: +91 88380 83381"
      },
      {
        "kind": "p",
        "text": "🌐 Website: https://sindhuspickles.com"
      },
      {
        "kind": "p",
        "text": "📍 Location: Tamil Nadu, India"
      },
      {
        "kind": "p",
        "text": "We’re happy to assist you Monday–Saturday, 10 AM – 6 PM."
      }
    ]
  },
  "privacy": {
    "title": "Privacy Policy",
    "oldPath": "/privacy-policy/",
    "blocks": [
      {
        "kind": "p",
        "text": "Last Updated: November 2025"
      },
      {
        "kind": "p",
        "text": "Welcome to Sindhu’s Pickles (referred to as “we,” “our,” or “us”)."
      },
      {
        "kind": "p",
        "text": "We value your privacy and are committed to protecting your personal information."
      },
      {
        "kind": "p",
        "text": "This Privacy Policy explains how we collect, use, and safeguard your data when you visit sindhuspickles.com or purchase our non-veg pickles and other food products online."
      },
      {
        "kind": "h",
        "text": "1. Information We Collect"
      },
      {
        "kind": "p",
        "text": "A. Personal Information"
      },
      {
        "kind": "p",
        "text": "When you place an order or create an account, we may collect:"
      },
      {
        "kind": "li",
        "text": "Full Name"
      },
      {
        "kind": "li",
        "text": "Email Address"
      },
      {
        "kind": "li",
        "text": "Phone Number"
      },
      {
        "kind": "li",
        "text": "Shipping & Billing Address"
      },
      {
        "kind": "li",
        "text": "Payment Information (processed via secure third-party gateways)"
      },
      {
        "kind": "p",
        "text": "B. Non-Personal / Technical Information"
      },
      {
        "kind": "p",
        "text": "We also collect non-identifiable data such as:"
      },
      {
        "kind": "li",
        "text": "Browser type and version"
      },
      {
        "kind": "li",
        "text": "IP address"
      },
      {
        "kind": "li",
        "text": "Device details"
      },
      {
        "kind": "li",
        "text": "Pages visited and time spent"
      },
      {
        "kind": "p",
        "text": "This helps us improve our services and website performance."
      },
      {
        "kind": "h",
        "text": "2. How We Use Your Information"
      },
      {
        "kind": "p",
        "text": "We use the collected information to:"
      },
      {
        "kind": "li",
        "text": "Process and deliver your pickle orders"
      },
      {
        "kind": "li",
        "text": "Communicate order updates and confirmations"
      },
      {
        "kind": "li",
        "text": "Improve our website and product quality"
      },
      {
        "kind": "li",
        "text": "Send offers and promotions (only if you opt in)"
      },
      {
        "kind": "li",
        "text": "Provide customer service and support"
      },
      {
        "kind": "p",
        "text": "We do not sell or rent your personal data to any third party."
      },
      {
        "kind": "h",
        "text": "3. Payment and Security"
      },
      {
        "kind": "p",
        "text": "Your online transactions are protected using SSL encryption."
      },
      {
        "kind": "p",
        "text": "Payments are processed securely through Razorpay / Paytm / UPI / Net Banking / Credit & Debit Cards."
      },
      {
        "kind": "p",
        "text": "We do not store your payment details (such as card numbers or CVV) on our servers."
      },
      {
        "kind": "h",
        "text": "4. Cookies Policy"
      },
      {
        "kind": "p",
        "text": "Our website uses cookies to:"
      },
      {
        "kind": "li",
        "text": "Store your preferences"
      },
      {
        "kind": "li",
        "text": "Track cart and checkout progress"
      },
      {
        "kind": "li",
        "text": "Analyze website traffic and improve performance"
      },
      {
        "kind": "p",
        "text": "You can disable cookies in your browser settings, but some parts of the website may not function properly if you do."
      },
      {
        "kind": "h",
        "text": "5. Third-Party Services"
      },
      {
        "kind": "p",
        "text": "We may share limited information with trusted third parties such as:"
      },
      {
        "kind": "li",
        "text": "Payment gateways (for transaction processing)"
      },
      {
        "kind": "li",
        "text": "Delivery partners (for order shipment)"
      },
      {
        "kind": "li",
        "text": "Analytics tools (like Google Analytics)"
      },
      {
        "kind": "li",
        "text": "Email or SMS providers (for order updates)"
      },
      {
        "kind": "p",
        "text": "These services are bound by confidentiality agreements and data protection obligations."
      },
      {
        "kind": "h",
        "text": "6. Data Retention"
      },
      {
        "kind": "p",
        "text": "We keep your data only as long as necessary to:"
      },
      {
        "kind": "li",
        "text": "Complete transactions"
      },
      {
        "kind": "li",
        "text": "Comply with legal requirements"
      },
      {
        "kind": "li",
        "text": "Improve our business operations"
      },
      {
        "kind": "p",
        "text": "If you wish to delete your data, please contact us — we’ll remove it unless required by law to retain it."
      },
      {
        "kind": "h",
        "text": "7. Your Rights"
      },
      {
        "kind": "p",
        "text": "You have full control over your data. You may:"
      },
      {
        "kind": "li",
        "text": "Request access to your personal information"
      },
      {
        "kind": "li",
        "text": "Ask for corrections or updates"
      },
      {
        "kind": "li",
        "text": "Withdraw consent for marketing emails"
      },
      {
        "kind": "li",
        "text": "Request deletion of your data"
      },
      {
        "kind": "p",
        "text": "To exercise these rights, email us at Info@sindhuspickles.com"
      },
      {
        "kind": "h",
        "text": "8. Updates to This Policy"
      },
      {
        "kind": "p",
        "text": "We may update this Privacy Policy periodically to reflect changes in our practices."
      },
      {
        "kind": "p",
        "text": "The latest version will always be available on this page. Please review it regularly."
      },
      {
        "kind": "h",
        "text": "9. Contact Us"
      },
      {
        "kind": "p",
        "text": "For questions or concerns about this Privacy Policy or our data handling practices, contact us:"
      },
      {
        "kind": "p",
        "text": "Sindhu’s Pickles"
      },
      {
        "kind": "p",
        "text": "📧 Email: Info@sindhuspickles.com"
      },
      {
        "kind": "p",
        "text": "🌐 Website: https://sindhuspickles.com"
      },
      {
        "kind": "p",
        "text": "📍 Location: 1-1/154 Indhra Nagar, Mohan Nagar Post, Salem -636030"
      }
    ]
  },
  "terms": {
    "title": "Terms and Conditions",
    "oldPath": "/terms-and-conditions/",
    "blocks": [
      {
        "kind": "p",
        "text": "Last Updated: November 2025"
      },
      {
        "kind": "p",
        "text": "Welcome to Sindhu’s Pickles (“we,” “our,” “us”)."
      },
      {
        "kind": "p",
        "text": "By accessing or purchasing from sindhuspickles.com, you agree to comply with and be bound by these Terms & Conditions."
      },
      {
        "kind": "p",
        "text": "Please read them carefully before using our website or placing an order."
      },
      {
        "kind": "h",
        "text": "1. General Overview"
      },
      {
        "kind": "p",
        "text": "Sindhu’s Pickles operates the website sindhuspickles.com to sell homemade non-vegetarian pickles and related food products across India."
      },
      {
        "kind": "p",
        "text": "By using our website, you:"
      },
      {
        "kind": "li",
        "text": "Acknowledge that you are 18 years or older"
      },
      {
        "kind": "li",
        "text": "Agree to provide accurate and up-to-date information"
      },
      {
        "kind": "li",
        "text": "Accept these Terms and our Privacy Policy"
      },
      {
        "kind": "p",
        "text": "If you do not agree with any part of these terms, please do not use our website."
      },
      {
        "kind": "h",
        "text": "2. Products and Availability"
      },
      {
        "kind": "li",
        "text": "All products displayed on our website are subject to availability."
      },
      {
        "kind": "li",
        "text": "We make every effort to accurately display product images and descriptions, but actual products may vary slightly in color or texture due to natural ingredients and handmade preparation."
      },
      {
        "kind": "li",
        "text": "We reserve the right to modify or discontinue products without prior notice."
      },
      {
        "kind": "h",
        "text": "3. Orders and Payments"
      },
      {
        "kind": "li",
        "text": "Orders can be placed directly through sindhuspickles.com."
      },
      {
        "kind": "li",
        "text": "You must provide correct billing, delivery, and contact details."
      },
      {
        "kind": "li",
        "text": "Payments are processed securely via trusted gateways like Razorpay / Paytm / UPI / Debit & Credit Cards / Net Banking."
      },
      {
        "kind": "li",
        "text": "We reserve the right to cancel any order suspected of fraudulent activity."
      },
      {
        "kind": "h",
        "text": "4. Pricing"
      },
      {
        "kind": "li",
        "text": "All prices are listed in Indian Rupees (INR) and are inclusive of applicable taxes unless mentioned otherwise."
      },
      {
        "kind": "li",
        "text": "We may update prices at any time without prior notice."
      },
      {
        "kind": "li",
        "text": "The price at the time of purchase will apply to your order."
      },
      {
        "kind": "h",
        "text": "5. Shipping and Delivery"
      },
      {
        "kind": "li",
        "text": "We deliver across most locations in India using reputed courier partners."
      },
      {
        "kind": "li",
        "text": "Estimated delivery time: 3–7 business days (depending on your location)."
      },
      {
        "kind": "li",
        "text": "Delivery delays caused by courier partners, weather, or unforeseen events are beyond our control."
      },
      {
        "kind": "li",
        "text": "You will receive tracking details once your order is shipped."
      },
      {
        "kind": "h",
        "text": "6. Return, Replacement & Refund Policy"
      },
      {
        "kind": "p",
        "text": "Because our non-veg pickles are perishable food items, we do not accept returns or exchanges once the product is delivered."
      },
      {
        "kind": "p",
        "text": "However, we do offer replacements or refunds only in the following cases:"
      },
      {
        "kind": "li",
        "text": "You receive a damaged or wrong product"
      },
      {
        "kind": "li",
        "text": "You report the issue within 24 hours of delivery"
      },
      {
        "kind": "li",
        "text": "You provide clear photo/video proof via email to info@sindhuspickles.com"
      },
      {
        "kind": "p",
        "text": "Our team will review and process eligible refunds within 5–7 business days."
      },
      {
        "kind": "h",
        "text": "7. Use of Website"
      },
      {
        "kind": "p",
        "text": "You agree not to:"
      },
      {
        "kind": "li",
        "text": "Use the website for illegal or unauthorized purposes"
      },
      {
        "kind": "li",
        "text": "Attempt to hack, modify, or disrupt our services"
      },
      {
        "kind": "li",
        "text": "Post or transmit any malicious or harmful content"
      },
      {
        "kind": "p",
        "text": "Violation of these terms may lead to suspension or permanent ban from our website."
      },
      {
        "kind": "h",
        "text": "8. Intellectual Property"
      },
      {
        "kind": "p",
        "text": "All content on sindhuspickles.com, including text, logos, photos, and product descriptions, is the property of Sindhu’s Pickles and protected under Indian copyright laws."
      },
      {
        "kind": "p",
        "text": "You may not copy, distribute, or reproduce any content without written permission."
      },
      {
        "kind": "h",
        "text": "9. Limitation of Liability"
      },
      {
        "kind": "p",
        "text": "Sindhu’s Pickles is not responsible for:"
      },
      {
        "kind": "li",
        "text": "Allergic reactions or health issues resulting from consumption (please check ingredients before use)"
      },
      {
        "kind": "li",
        "text": "Delays or failures caused by events beyond our control"
      },
      {
        "kind": "li",
        "text": "Any indirect, incidental, or consequential damages"
      },
      {
        "kind": "p",
        "text": "All our pickles are prepared hygienically using traditional methods, but customers consume at their own discretion."
      },
      {
        "kind": "h",
        "text": "10. Governing Law"
      },
      {
        "kind": "p",
        "text": "These Terms & Conditions are governed by the laws of India."
      },
      {
        "kind": "p",
        "text": "Any disputes shall be subject to the jurisdiction of the courts located in Tamil Nadu, India."
      },
      {
        "kind": "p",
        "text": "11.Contact Us"
      },
      {
        "kind": "p",
        "text": "For questions or concerns about this Privacy Policy or our data handling practices, contact us:"
      },
      {
        "kind": "p",
        "text": "Sindhu’s Pickles"
      },
      {
        "kind": "p",
        "text": "Email: Info@sindhuspickles.com"
      },
      {
        "kind": "p",
        "text": "Website: https://sindhuspickles.com"
      },
      {
        "kind": "p",
        "text": "Location: 1-1/154 Indhra Nagar, Mohan Nagar Post, Salem -636030."
      }
    ]
  }
};
