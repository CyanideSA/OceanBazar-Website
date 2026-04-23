export type PolicyLocale = 'en' | 'bn';

export type PolicyKey =
  | 'privacy'
  | 'returns'
  | 'refunds'
  | 'shipping'
  | 'terms'
  | 'warranty';

export type SectionIcon =
  | 'shield' | 'check' | 'clock' | 'alert' | 'info' | 'truck'
  | 'package' | 'credit' | 'ban' | 'file' | 'scale' | 'lock'
  | 'refresh' | 'star' | 'list' | 'user' | 'mail';

export interface PolicySection {
  heading: string;
  body: string;
  icon?: SectionIcon;
  highlight?: string;
  bullets?: string[];
  tag?: 'eligibility' | 'process' | 'timeline' | 'conditions' | 'info';
}

export interface PolicyDocument {
  title: string;
  intro: string;
  lastUpdated?: string;
  sections: PolicySection[];
}

const EN_POLICIES: Record<PolicyKey, PolicyDocument> = {
  privacy: {
    title: 'Privacy Policy',
    lastUpdated: 'April 2025',
    intro:
      'Ocean Bazar collects only the minimum information needed to process orders, improve service, and keep your account secure. We do not sell or rent your personal data.',
    sections: [
      {
        icon: 'list',
        tag: 'info',
        heading: 'Information we collect',
        body: 'We collect only what is necessary to deliver our service.',
        bullets: [
          'Name, phone number, and email address for account and communication',
          'Delivery address for order fulfillment',
          'Order history and browsing activity for personalization',
          'Payment metadata (we never store full card numbers)',
          'Device and browser info for security and fraud prevention',
        ],
      },
      {
        icon: 'shield',
        tag: 'info',
        heading: 'How we use your information',
        body: 'Your data is used strictly to run and improve the platform.',
        bullets: [
          'Process and fulfill your orders',
          'Send order status notifications and receipts',
          'Provide customer support and resolve disputes',
          'Detect and prevent fraudulent activity',
          'Improve product recommendations and platform features',
        ],
      },
      {
        icon: 'lock',
        tag: 'conditions',
        heading: 'Data protection',
        body:
          'We use industry-standard encryption (TLS) for data in transit and apply strict access controls internally. Only authorized personnel can access customer data, and only when required.',
        highlight: 'We do not sell, rent, or share your personal data with third parties for marketing purposes.',
      },
      {
        icon: 'user',
        tag: 'info',
        heading: 'Third-party services',
        body: 'Certain trusted partners may process limited data to fulfil their specific role.',
        bullets: [
          'Payment gateways (bKash, Nagad, SSLCommerz) — for transaction processing only',
          'Courier partners — for delivery fulfillment',
          'Analytics tools — anonymized usage data only',
        ],
      },
      {
        icon: 'mail',
        tag: 'process',
        heading: 'Your rights',
        body: 'You may request access to, correction of, or deletion of your personal data at any time by contacting support. Account deletion requests are processed within 7 business days.',
      },
    ],
  },

  returns: {
    title: 'Return Policy',
    lastUpdated: 'April 2025',
    intro:
      'Eligible items may be returned within the approved return window. Returns are subject to product condition, category rules, and verification by our team.',
    sections: [
      {
        icon: 'check',
        tag: 'eligibility',
        heading: 'Return eligibility',
        body: 'To qualify for a return, all of the following must apply:',
        bullets: [
          'Return request raised within 7 days of confirmed delivery',
          'Product is unused and in original, undamaged condition',
          'All original packaging, tags, accessories, and manuals are included',
          'Proof of purchase (order ID) is provided',
          'Product is not listed under non-returnable categories',
        ],
        highlight: 'The return window is 7 days from the delivery date shown in your order timeline.',
      },
      {
        icon: 'ban',
        tag: 'conditions',
        heading: 'Non-returnable items',
        body: 'The following product types are not eligible for return regardless of condition:',
        bullets: [
          'Perishable goods and food items',
          'Personal care, hygiene, and intimate products',
          'Digital goods, software, and vouchers',
          'Custom or personalised items',
          'Products marked "Final Sale" or "Non-returnable" on the listing',
          'Items damaged by the customer after delivery',
        ],
      },
      {
        icon: 'package',
        tag: 'process',
        heading: 'How to initiate a return',
        body: 'Follow these steps to start a return:',
        bullets: [
          'Go to My Orders and select the order containing the item',
          'Tap "Return / Dispute" and choose the item and reason',
          'Upload photos if the item is damaged or incorrect',
          'Submit — our team will review within 1–2 business days',
          'Once approved, you will receive pickup or drop-off instructions',
        ],
      },
      {
        icon: 'clock',
        tag: 'timeline',
        heading: 'Return timelines',
        body: 'After initiating a return request, here is what to expect:',
        bullets: [
          'Review decision: 1–2 business days',
          'Pickup / drop-off arrangement: 1–3 business days after approval',
          'Item inspection after receipt: up to 2 business days',
          'Refund initiation after inspection pass: 1–3 business days',
        ],
      },
      {
        icon: 'alert',
        tag: 'conditions',
        heading: 'Condition check',
        body:
          'All returned items are inspected before final approval. Returns may be rejected if the product shows signs of use, tampering, missing parts, or damage not reported at time of filing.',
        highlight: 'If a return is rejected after inspection, the item will be shipped back to you at no additional cost.',
      },
    ],
  },

  refunds: {
    title: 'Refund Policy',
    lastUpdated: 'April 2025',
    intro:
      'Approved refunds are processed to the original payment method after order verification. Timelines vary by payment method and case type.',
    sections: [
      {
        icon: 'check',
        tag: 'eligibility',
        heading: 'When refunds are approved',
        body: 'Refunds are issued in the following cases:',
        bullets: [
          'Order cancelled before dispatch',
          'Item not delivered within the maximum estimated window',
          'Item received is damaged, defective, or materially different from listing',
          'Return request approved and item passes inspection',
          'Duplicate or erroneous charge confirmed by our team',
        ],
      },
      {
        icon: 'clock',
        tag: 'timeline',
        heading: 'Refund timelines by payment method',
        body: 'Processing time after approval:',
        bullets: [
          'bKash / Nagad / Rocket / Upay — within 3 business days',
          'SSLCommerz (card/internet banking) — 5–10 business days depending on issuing bank',
          'OB Points (if used) — restored within 24 hours',
          'Cash on Delivery — refund via mobile wallet within 3 business days',
        ],
        highlight: 'All timelines start from the date our team marks the refund as approved, not from when you submit the request.',
      },
      {
        icon: 'scale',
        tag: 'conditions',
        heading: 'Partial refunds',
        body: 'A partial refund may be issued when:',
        bullets: [
          'Only part of a multi-item order is returned',
          'An item passes partial inspection (e.g. accessory missing)',
          'Delivery fee was already incurred and is non-refundable in that case',
          'A promotional discount applied only to part of the order',
        ],
      },
      {
        icon: 'alert',
        tag: 'process',
        heading: 'Failed or delayed refunds',
        body:
          'If your refund does not arrive within the stated window, first check your payment provider app or bank statement. If still missing, open a support ticket with your order number and payment method. Our team will trace and escalate within 2 business days.',
        highlight: 'Always include your Order ID when contacting support about a refund.',
      },
      {
        icon: 'info',
        tag: 'conditions',
        heading: 'Non-refundable amounts',
        body: 'The following are generally not refunded:',
        bullets: [
          'Service fees on successfully processed orders',
          'Shipping fees on orders where delivery was completed',
          'OB Points bonus redemptions (reversed, not cash-refunded)',
        ],
      },
    ],
  },

  shipping: {
    title: 'Shipping Policy',
    lastUpdated: 'April 2025',
    intro:
      'Ocean Bazar delivers across all 64 districts of Bangladesh. Delivery time and cost depend on your location, product type, and courier availability.',
    sections: [
      {
        icon: 'truck',
        tag: 'info',
        heading: 'Delivery coverage',
        body: 'We partner with trusted couriers to reach:',
        bullets: [
          'All major cities — Dhaka, Chittagong, Sylhet, Rajshahi, Khulna, Barisal, Rangpur, Mymensingh',
          'All 64 districts nationwide',
          'Remote and upazila-level destinations (may take longer)',
        ],
        highlight: 'Some areas may have limited payment or delivery options due to courier coverage.',
      },
      {
        icon: 'clock',
        tag: 'timeline',
        heading: 'Estimated delivery timelines',
        body: 'After order dispatch:',
        bullets: [
          'Dhaka metro area — 1–2 business days',
          'Other major cities — 2–3 business days',
          'District towns and rural areas — 3–5 business days',
          'Remote or hard-to-reach zones — up to 7 business days',
        ],
      },
      {
        icon: 'credit',
        tag: 'conditions',
        heading: 'Shipping charges',
        body:
          'Shipping fees are calculated at checkout based on your location, order weight, and any active promotions. Some orders qualify for free or subsidised shipping.',
        bullets: [
          'Standard shipping: ৳25–৳80 depending on zone',
          'Free shipping thresholds may apply during campaigns',
          'Bulky or fragile items may incur additional handling fees',
        ],
      },
      {
        icon: 'alert',
        tag: 'conditions',
        heading: 'Delivery attempts',
        body:
          'Couriers will attempt delivery at the address and phone number provided. Please ensure you are reachable.',
        bullets: [
          'Up to 2 delivery attempts are made before return to warehouse',
          'Failed delivery due to wrong address or unavailability may require re-dispatch fees',
          'COD orders that are refused on delivery may result in account restrictions',
        ],
      },
    ],
  },

  terms: {
    title: 'Terms & Conditions',
    lastUpdated: 'April 2025',
    intro:
      'By accessing or using Ocean Bazar, you agree to abide by these terms. Please read them carefully. These terms govern all transactions, account use, and platform interactions.',
    sections: [
      {
        icon: 'user',
        tag: 'conditions',
        heading: 'Account responsibility',
        body: 'You are responsible for all activity on your account.',
        bullets: [
          'Keep your login credentials confidential',
          'Provide accurate name, contact, and address information',
          'Notify us immediately of any unauthorized account access',
          'One account per person — duplicate accounts may be merged or removed',
        ],
      },
      {
        icon: 'credit',
        tag: 'conditions',
        heading: 'Pricing and availability',
        body:
          'All prices are in Bangladeshi Taka (BDT) and include applicable taxes unless stated otherwise.',
        bullets: [
          'Prices may change without prior notice',
          'Promotions and discounts are time-limited and subject to stock',
          'We reserve the right to correct pricing errors before dispatch',
          'Out-of-stock items may be cancelled with a full refund',
        ],
        highlight: 'An order confirmation email is not a guarantee of acceptance — see Order Acceptance below.',
      },
      {
        icon: 'file',
        tag: 'process',
        heading: 'Order acceptance',
        body:
          'Placing an order is an offer to purchase, not a confirmed sale. We reserve the right to reject or cancel orders in the following situations:',
        bullets: [
          'Suspected fraud or account abuse',
          'Pricing error or stock discrepancy discovered after placement',
          'Payment not verified within the required window',
          'Address or identity cannot be verified for high-value orders',
        ],
      },
      {
        icon: 'ban',
        tag: 'conditions',
        heading: 'Prohibited conduct',
        body: 'The following actions are strictly prohibited and may result in permanent account suspension:',
        bullets: [
          'Creating fake accounts or impersonating others',
          'Abusing promotions, coupons, or referral programs',
          'Making fraudulent return or refund claims',
          'Attempting to manipulate reviews or ratings',
          'Reverse-engineering, scraping, or attacking platform systems',
        ],
      },
      {
        icon: 'scale',
        tag: 'conditions',
        heading: 'Dispute resolution',
        body:
          'All disputes should be raised through the official support ticket system. Ocean Bazar will mediate in good faith. Unresolved disputes are subject to Bangladeshi law and jurisdiction of Dhaka courts.',
      },
      {
        icon: 'info',
        tag: 'conditions',
        heading: 'Limitation of liability',
        body:
          'Ocean Bazar is not liable for indirect, incidental, or consequential damages arising from use of the platform, to the maximum extent permitted by applicable law. Our total liability for any claim is limited to the value of the affected order.',
      },
      {
        icon: 'refresh',
        tag: 'info',
        heading: 'Changes to these terms',
        body:
          'We may update these terms at any time. Continued use of the platform after changes constitutes acceptance. Significant changes will be communicated via email or in-app notification.',
      },
    ],
  },

  warranty: {
    title: 'Warranty Policy',
    lastUpdated: 'April 2025',
    intro:
      'Warranty coverage depends on the product brand, seller commitment, and applicable manufacturer terms. Always check the product listing for specific warranty information.',
    sections: [
      {
        icon: 'star',
        tag: 'eligibility',
        heading: 'Types of warranty',
        body: 'Products on Ocean Bazar may carry one or more of the following warranty types:',
        bullets: [
          'Brand / manufacturer warranty — serviced at brand service centers',
          'Seller warranty — replacement or repair handled by the seller',
          'Ocean Bazar platform warranty — for selected product categories',
        ],
        highlight: 'Warranty type and duration are listed on the product page. Check before purchasing.',
      },
      {
        icon: 'ban',
        tag: 'conditions',
        heading: 'What is not covered',
        body: 'Warranty claims are void in the following cases:',
        bullets: [
          'Physical damage caused after delivery (drops, cracks, bends)',
          'Liquid or moisture damage',
          'Unauthorized repair, modification, or opening of the device',
          'Electrical damage from improper power use',
          'Normal wear and tear',
          'Damage from misuse or use outside recommended conditions',
        ],
      },
      {
        icon: 'package',
        tag: 'process',
        heading: 'How to file a warranty claim',
        body: 'To initiate a warranty claim:',
        bullets: [
          'Open a support ticket from the order detail page',
          'Select "Warranty Claim" as the category',
          'Provide: order ID, product serial/IMEI number, description of issue',
          'Attach clear photos or a short video demonstrating the defect',
          'Our team will verify and route the claim to the appropriate service party',
        ],
      },
      {
        icon: 'clock',
        tag: 'timeline',
        heading: 'Warranty service timelines',
        body: 'Timelines vary by claim type:',
        bullets: [
          'Claim review by Ocean Bazar team: 1–2 business days',
          'Brand service center repair: 7–21 business days (varies by brand)',
          'Seller-handled replacement: 3–7 business days',
          'Parts not available: up to 30 days — you will be notified',
        ],
      },
    ],
  },
};

const BN_POLICIES: Record<PolicyKey, PolicyDocument> = {
  privacy: {
    title: 'প্রাইভেসি পলিসি',
    lastUpdated: 'এপ্রিল ২০২৫',
    intro:
      'Ocean Bazar অর্ডার প্রসেস, সেবা উন্নয়ন এবং আপনার অ্যাকাউন্ট নিরাপদ রাখতে শুধুমাত্র প্রয়োজনীয় তথ্য সংগ্রহ করে। আমরা আপনার ব্যক্তিগত তথ্য বিক্রি বা ভাড়া দিই না।',
    sections: [
      {
        icon: 'list',
        tag: 'info',
        heading: 'আমরা কী তথ্য সংগ্রহ করি',
        body: 'আমাদের সেবা প্রদানের জন্য শুধুমাত্র প্রয়োজনীয় তথ্য সংগ্রহ করি।',
        bullets: [
          'অ্যাকাউন্ট ও যোগাযোগের জন্য নাম, ফোন নম্বর এবং ইমেইল ঠিকানা',
          'অর্ডার পূরণের জন্য ডেলিভারি ঠিকানা',
          'ব্যক্তিগতকরণের জন্য অর্ডার ইতিহাস ও ব্রাউজিং কার্যক্রম',
          'পেমেন্ট মেটাডেটা (আমরা কখনো সম্পূর্ণ কার্ড নম্বর সংরক্ষণ করি না)',
          'নিরাপত্তা ও জালিয়াতি প্রতিরোধের জন্য ডিভাইস ও ব্রাউজারের তথ্য',
        ],
      },
      {
        icon: 'shield',
        tag: 'info',
        heading: 'তথ্য কীভাবে ব্যবহার করি',
        body: 'আপনার তথ্য শুধুমাত্র প্ল্যাটফর্ম পরিচালনা ও উন্নয়নে ব্যবহৃত হয়।',
        bullets: [
          'আপনার অর্ডার প্রসেস ও পূরণ করা',
          'অর্ডারের স্ট্যাটাস নোটিফিকেশন ও রসিদ পাঠানো',
          'কাস্টমার সাপোর্ট ও বিরোধ নিষ্পত্তি',
          'জালিয়াতি শনাক্তকরণ ও প্রতিরোধ',
          'পণ্যের সুপারিশ ও প্ল্যাটফর্ম ফিচার উন্নয়ন',
        ],
      },
      {
        icon: 'lock',
        tag: 'conditions',
        heading: 'ডেটা সুরক্ষা',
        body:
          'আমরা ডেটা ট্রান্সমিশনের জন্য ইন্ডাস্ট্রি-স্ট্যান্ডার্ড এনক্রিপশন (TLS) ব্যবহার করি এবং অভ্যন্তরীণভাবে কঠোর অ্যাক্সেস কন্ট্রোল প্রয়োগ করি।',
        highlight: 'আমরা বিপণনের উদ্দেশ্যে আপনার ব্যক্তিগত তথ্য তৃতীয় পক্ষের কাছে বিক্রি, ভাড়া বা শেয়ার করি না।',
      },
      {
        icon: 'user',
        tag: 'info',
        heading: 'তৃতীয় পক্ষের সেবা',
        body: 'কিছু বিশ্বস্ত অংশীদার তাদের নির্দিষ্ট ভূমিকা পূরণে সীমিত তথ্য প্রক্রিয়া করতে পারে।',
        bullets: [
          'পেমেন্ট গেটওয়ে (বিকাশ, নগদ, SSLCommerz) — শুধুমাত্র লেনদেন প্রক্রিয়াকরণের জন্য',
          'কুরিয়ার পার্টনার — ডেলিভারি পূরণের জন্য',
          'অ্যানালিটিক্স টুল — শুধুমাত্র বেনামী ব্যবহারের তথ্য',
        ],
      },
      {
        icon: 'mail',
        tag: 'process',
        heading: 'আপনার অধিকার',
        body: 'আপনি যেকোনো সময় সাপোর্টে যোগাযোগ করে আপনার ব্যক্তিগত তথ্যে অ্যাক্সেস, সংশোধন বা মুছে ফেলার অনুরোধ করতে পারেন। অ্যাকাউন্ট মুছে ফেলার অনুরোধ ৭ কর্মদিবসের মধ্যে প্রসেস করা হয়।',
      },
    ],
  },

  returns: {
    title: 'রিটার্ন পলিসি',
    lastUpdated: 'এপ্রিল ২০২৫',
    intro:
      'যোগ্য পণ্য অনুমোদিত রিটার্ন সময়সীমার মধ্যে ফেরত দেওয়া যেতে পারে। রিটার্ন পণ্যের অবস্থা, ক্যাটাগরি নিয়ম এবং আমাদের টিমের যাচাইয়ের উপর নির্ভরশীল।',
    sections: [
      {
        icon: 'check',
        tag: 'eligibility',
        heading: 'রিটার্নের যোগ্যতা',
        body: 'রিটার্নের জন্য যোগ্য হতে নিম্নলিখিত সব শর্ত পূরণ করতে হবে:',
        bullets: [
          'ডেলিভারি নিশ্চিত হওয়ার ৭ দিনের মধ্যে রিটার্ন অনুরোধ করতে হবে',
          'পণ্যটি অব্যবহৃত ও আসল অবস্থায় থাকতে হবে',
          'সকল আসল প্যাকেজিং, ট্যাগ, এক্সেসরিজ ও ম্যানুয়াল অন্তর্ভুক্ত থাকতে হবে',
          'ক্রয়ের প্রমাণ (অর্ডার আইডি) প্রদান করতে হবে',
          'পণ্যটি ফেরতযোগ্য নয় এমন তালিকায় না থাকতে হবে',
        ],
        highlight: 'রিটার্ন উইন্ডো হলো আপনার অর্ডার টাইমলাইনে দেখানো ডেলিভারি তারিখ থেকে ৭ দিন।',
      },
      {
        icon: 'ban',
        tag: 'conditions',
        heading: 'যে পণ্য ফেরতযোগ্য নয়',
        body: 'অবস্থা নির্বিশেষে নিম্নলিখিত পণ্য রিটার্নের যোগ্য নয়:',
        bullets: [
          'পচনশীল পণ্য ও খাদ্যসামগ্রী',
          'ব্যক্তিগত যত্ন, স্বাস্থ্যবিধি ও অন্তরঙ্গ পণ্য',
          'ডিজিটাল পণ্য, সফটওয়্যার ও ভাউচার',
          'কাস্টম বা ব্যক্তিগতকৃত পণ্য',
          'লিস্টিংয়ে "ফাইনাল সেল" বা "ফেরতযোগ্য নয়" চিহ্নিত পণ্য',
          'ডেলিভারির পর কাস্টমারের দ্বারা ক্ষতিগ্রস্ত পণ্য',
        ],
      },
      {
        icon: 'package',
        tag: 'process',
        heading: 'রিটার্ন শুরু করার উপায়',
        body: 'রিটার্ন শুরু করতে এই ধাপগুলো অনুসরণ করুন:',
        bullets: [
          'মাই অর্ডারে গিয়ে সংশ্লিষ্ট অর্ডার নির্বাচন করুন',
          '"রিটার্ন / ডিসপিউট" ট্যাপ করে আইটেম ও কারণ বেছে নিন',
          'পণ্য ক্ষতিগ্রস্ত বা ভুল হলে ছবি আপলোড করুন',
          'জমা দিন — আমাদের টিম ১–২ কর্মদিবসের মধ্যে পর্যালোচনা করবে',
          'অনুমোদনের পর পিকআপ বা ড্রপ-অফ নির্দেশনা পাবেন',
        ],
      },
      {
        icon: 'clock',
        tag: 'timeline',
        heading: 'রিটার্ন সময়সীমা',
        body: 'রিটার্ন অনুরোধ করার পর কী আশা করবেন:',
        bullets: [
          'পর্যালোচনার সিদ্ধান্ত: ১–২ কর্মদিবস',
          'পিকআপ / ড্রপ-অফ ব্যবস্থা: অনুমোদনের পর ১–৩ কর্মদিবস',
          'পণ্য গ্রহণের পর পরিদর্শন: ২ কর্মদিবস পর্যন্ত',
          'পরিদর্শন পাস হলে রিফান্ড শুরু: ১–৩ কর্মদিবস',
        ],
      },
      {
        icon: 'alert',
        tag: 'conditions',
        heading: 'অবস্থা পরীক্ষা',
        body:
          'চূড়ান্ত অনুমোদনের আগে সকল ফেরত আসা পণ্য পরিদর্শন করা হয়। পণ্যে ব্যবহারের চিহ্ন, ট্যাম্পারিং, অনুপস্থিত যন্ত্রাংশ বা দাখিলের সময় রিপোর্ট না করা ক্ষতি পাওয়া গেলে রিটার্ন প্রত্যাখ্যান হতে পারে।',
        highlight: 'পরিদর্শনের পর রিটার্ন প্রত্যাখ্যাত হলে, পণ্যটি কোনো অতিরিক্ত খরচ ছাড়াই আপনাকে ফেরত পাঠানো হবে।',
      },
    ],
  },

  refunds: {
    title: 'রিফান্ড পলিসি',
    lastUpdated: 'এপ্রিল ২০২৫',
    intro:
      'অনুমোদিত রিফান্ড অর্ডার যাচাইয়ের পর মূল পেমেন্ট পদ্ধতিতে প্রসেস করা হয়। সময়সীমা পেমেন্ট পদ্ধতি ও কেস ধরনের উপর নির্ভর করে।',
    sections: [
      {
        icon: 'check',
        tag: 'eligibility',
        heading: 'কখন রিফান্ড অনুমোদিত হয়',
        body: 'নিম্নলিখিত ক্ষেত্রে রিফান্ড দেওয়া হয়:',
        bullets: [
          'ডিসপ্যাচের আগে অর্ডার বাতিল',
          'সর্বোচ্চ আনুমানিক সময়ের মধ্যে পণ্য ডেলিভার না হলে',
          'গ্রহণকৃত পণ্য ক্ষতিগ্রস্ত, ত্রুটিপূর্ণ বা লিস্টিং থেকে উল্লেখযোগ্যভাবে ভিন্ন',
          'রিটার্ন অনুরোধ অনুমোদিত এবং পণ্য পরিদর্শন পাস',
          'আমাদের টিম কর্তৃক নিশ্চিত ডুপ্লিকেট বা ভুল চার্জ',
        ],
      },
      {
        icon: 'clock',
        tag: 'timeline',
        heading: 'পেমেন্ট পদ্ধতি অনুযায়ী রিফান্ড সময়সীমা',
        body: 'অনুমোদনের পর প্রসেসিং সময়:',
        bullets: [
          'বিকাশ / নগদ / রকেট / উপায় — ৩ কর্মদিবসের মধ্যে',
          'SSLCommerz (কার্ড/ইন্টারনেট ব্যাংকিং) — ইস্যুকারী ব্যাংকের উপর নির্ভর করে ৫–১০ কর্মদিবস',
          'OB পয়েন্ট (যদি ব্যবহৃত হয়) — ২৪ ঘণ্টার মধ্যে পুনরুদ্ধার',
          'ক্যাশ অন ডেলিভারি — ৩ কর্মদিবসের মধ্যে মোবাইল ওয়ালেটে রিফান্ড',
        ],
        highlight: 'সকল সময়সীমা আমাদের টিম রিফান্ড অনুমোদন করার তারিখ থেকে শুরু হয়, অনুরোধ জমা দেওয়ার তারিখ থেকে নয়।',
      },
      {
        icon: 'scale',
        tag: 'conditions',
        heading: 'আংশিক রিফান্ড',
        body: 'নিম্নলিখিত ক্ষেত্রে আংশিক রিফান্ড দেওয়া হতে পারে:',
        bullets: [
          'মাল্টি-আইটেম অর্ডারের শুধুমাত্র অংশবিশেষ ফেরত',
          'পণ্য আংশিক পরিদর্শন পাস করলে (যেমন এক্সেসরি অনুপস্থিত)',
          'ডেলিভারি ফি ইতিমধ্যে খরচ হয়ে গেলে এবং সেক্ষেত্রে অফেরতযোগ্য',
          'অর্ডারের অংশবিশেষে প্রমোশনাল ডিসকাউন্ট প্রযোজ্য হলে',
        ],
      },
      {
        icon: 'alert',
        tag: 'process',
        heading: 'ব্যর্থ বা বিলম্বিত রিফান্ড',
        body:
          'নির্ধারিত সময়ের মধ্যে রিফান্ড না পেলে, প্রথমে আপনার পেমেন্ট প্রদানকারী অ্যাপ বা ব্যাংক স্টেটমেন্ট দেখুন। এখনো পাননি? অর্ডার নম্বর ও পেমেন্ট পদ্ধতিসহ একটি সাপোর্ট টিকেট খুলুন।',
        highlight: 'রিফান্ড সংক্রান্ত সাপোর্টে যোগাযোগের সময় সবসময় আপনার অর্ডার আইডি উল্লেখ করুন।',
      },
      {
        icon: 'info',
        tag: 'conditions',
        heading: 'অফেরতযোগ্য পরিমাণ',
        body: 'সাধারণত নিম্নলিখিত পরিমাণ রিফান্ড করা হয় না:',
        bullets: [
          'সফলভাবে প্রসেসকৃত অর্ডারের সার্ভিস ফি',
          'ডেলিভারি সম্পন্ন হওয়া অর্ডারের শিপিং ফি',
          'OB পয়েন্ট বোনাস রিডেম্পশন (বিপরীত করা হয়, নগদ রিফান্ড নয়)',
        ],
      },
    ],
  },

  shipping: {
    title: 'শিপিং পলিসি',
    lastUpdated: 'এপ্রিল ২০২৫',
    intro:
      'Ocean Bazar বাংলাদেশের সকল ৬৪ জেলায় ডেলিভারি দেয়। ডেলিভারির সময় ও খরচ আপনার অবস্থান, পণ্যের ধরন ও কুরিয়ারের প্রাপ্যতার উপর নির্ভর করে।',
    sections: [
      {
        icon: 'truck',
        tag: 'info',
        heading: 'ডেলিভারি কভারেজ',
        body: 'আমরা বিশ্বস্ত কুরিয়ার পার্টনারদের সাথে ডেলিভারি দিই:',
        bullets: [
          'সকল প্রধান শহর — ঢাকা, চট্টগ্রাম, সিলেট, রাজশাহী, খুলনা, বরিশাল, রংপুর, ময়মনসিংহ',
          'সারাদেশের সকল ৬৪ জেলা',
          'দূরবর্তী ও উপজেলা পর্যায়ের গন্তব্য (বেশি সময় লাগতে পারে)',
        ],
        highlight: 'কুরিয়ার কভারেজের কারণে কিছু এলাকায় পেমেন্ট বা ডেলিভারি অপশন সীমিত হতে পারে।',
      },
      {
        icon: 'clock',
        tag: 'timeline',
        heading: 'আনুমানিক ডেলিভারি সময়',
        body: 'অর্ডার ডিসপ্যাচের পর:',
        bullets: [
          'ঢাকা মেট্রো এলাকা — ১–২ কর্মদিবস',
          'অন্যান্য প্রধান শহর — ২–৩ কর্মদিবস',
          'জেলা শহর ও গ্রামীণ এলাকা — ৩–৫ কর্মদিবস',
          'দূরবর্তী বা দুর্গম এলাকা — ৭ কর্মদিবস পর্যন্ত',
        ],
      },
      {
        icon: 'credit',
        tag: 'conditions',
        heading: 'শিপিং চার্জ',
        body:
          'শিপিং ফি চেকআউটের সময় আপনার অবস্থান, অর্ডারের ওজন এবং সক্রিয় প্রমোশনের উপর ভিত্তি করে গণনা করা হয়।',
        bullets: [
          'স্ট্যান্ডার্ড শিপিং: জোন অনুযায়ী ৳২৫–৳৮০',
          'ক্যাম্পেইনের সময় ফ্রি শিপিং থ্রেশহোল্ড প্রযোজ্য হতে পারে',
          'ভারী বা ভঙ্গুর পণ্যে অতিরিক্ত হ্যান্ডলিং ফি লাগতে পারে',
        ],
      },
      {
        icon: 'alert',
        tag: 'conditions',
        heading: 'ডেলিভারি প্রচেষ্টা',
        body:
          'কুরিয়ার প্রদত্ত ঠিকানা ও ফোন নম্বরে ডেলিভারি দেওয়ার চেষ্টা করবে। দয়া করে যোগাযোগযোগ্য থাকুন।',
        bullets: [
          'গুদামে ফেরত পাঠানোর আগে সর্বোচ্চ ২ বার ডেলিভারি চেষ্টা করা হয়',
          'ভুল ঠিকানা বা অনুপলব্ধতার কারণে ব্যর্থ ডেলিভারিতে পুনরায় ডিসপ্যাচ ফি লাগতে পারে',
          'ডেলিভারির সময় প্রত্যাখ্যাত COD অর্ডারে অ্যাকাউন্ট সীমাবদ্ধতা হতে পারে',
        ],
      },
    ],
  },

  terms: {
    title: 'শর্তাবলি',
    lastUpdated: 'এপ্রিল ২০২৫',
    intro:
      'Ocean Bazar অ্যাক্সেস বা ব্যবহার করার মাধ্যমে আপনি এই শর্তাবলি মেনে চলতে সম্মত হচ্ছেন। এই শর্তাবলি সকল লেনদেন, অ্যাকাউন্ট ব্যবহার এবং প্ল্যাটফর্ম ইন্টারঅ্যাকশন নিয়ন্ত্রণ করে।',
    sections: [
      {
        icon: 'user',
        tag: 'conditions',
        heading: 'অ্যাকাউন্টের দায়িত্ব',
        body: 'আপনার অ্যাকাউন্টের সকল কার্যক্রমের জন্য আপনি দায়ী।',
        bullets: [
          'আপনার লগইন তথ্য গোপনীয় রাখুন',
          'সঠিক নাম, যোগাযোগ ও ঠিকানার তথ্য প্রদান করুন',
          'অননুমোদিত অ্যাকাউন্ট অ্যাক্সেস হলে অবিলম্বে আমাদের জানান',
          'প্রতি ব্যক্তি একটি অ্যাকাউন্ট — ডুপ্লিকেট অ্যাকাউন্ট মার্জ বা অপসারণ করা হতে পারে',
        ],
      },
      {
        icon: 'credit',
        tag: 'conditions',
        heading: 'মূল্য ও প্রাপ্যতা',
        body:
          'সকল মূল্য বাংলাদেশী টাকায় (BDT) এবং অন্যথায় উল্লেখ না থাকলে প্রযোজ্য কর অন্তর্ভুক্ত।',
        bullets: [
          'পূর্ব ঘোষণা ছাড়াই মূল্য পরিবর্তন হতে পারে',
          'প্রমোশন ও ডিসকাউন্ট সময়-সীমিত এবং স্টক সাপেক্ষে',
          'ডিসপ্যাচের আগে মূল্য ত্রুটি সংশোধনের অধিকার সংরক্ষিত',
          'স্টক শেষ হওয়া পণ্যের অর্ডার সম্পূর্ণ রিফান্ডসহ বাতিল হতে পারে',
        ],
        highlight: 'অর্ডার কনফার্মেশন ইমেইল গ্রহণের নিশ্চয়তা নয় — নীচে অর্ডার গ্রহণ দেখুন।',
      },
      {
        icon: 'file',
        tag: 'process',
        heading: 'অর্ডার গ্রহণ',
        body:
          'অর্ডার দেওয়া হলো ক্রয়ের প্রস্তাব, নিশ্চিত বিক্রয় নয়। নিম্নলিখিত পরিস্থিতিতে অর্ডার প্রত্যাখ্যান বা বাতিল করার অধিকার সংরক্ষিত:',
        bullets: [
          'সন্দেহজনক জালিয়াতি বা অ্যাকাউন্ট অপব্যবহার',
          'অর্ডার দেওয়ার পর মূল্য ত্রুটি বা স্টক অমিল ধরা পড়লে',
          'নির্ধারিত সময়ের মধ্যে পেমেন্ট যাচাই না হলে',
          'উচ্চ মূল্যের অর্ডারে ঠিকানা বা পরিচয় যাচাই করা না গেলে',
        ],
      },
      {
        icon: 'ban',
        tag: 'conditions',
        heading: 'নিষিদ্ধ আচরণ',
        body: 'নিম্নলিখিত কার্যক্রম কঠোরভাবে নিষিদ্ধ এবং স্থায়ী অ্যাকাউন্ট স্থগিত হতে পারে:',
        bullets: [
          'ভুয়া অ্যাকাউন্ট তৈরি বা অন্যের ছদ্মবেশ ধারণ',
          'প্রমোশন, কুপন বা রেফারেল প্রোগ্রামের অপব্যবহার',
          'প্রতারণামূলক রিটার্ন বা রিফান্ড দাবি',
          'রিভিউ বা রেটিং ম্যানিপুলেশনের চেষ্টা',
          'প্ল্যাটফর্ম সিস্টেমে রিভার্স-ইঞ্জিনিয়ারিং, স্ক্র্যাপিং বা আক্রমণ',
        ],
      },
      {
        icon: 'scale',
        tag: 'conditions',
        heading: 'বিরোধ নিষ্পত্তি',
        body:
          'সকল বিরোধ অফিসিয়াল সাপোর্ট টিকেট সিস্টেমের মাধ্যমে উত্থাপন করতে হবে। Ocean Bazar সদ্বিশ্বাসে মধ্যস্থতা করবে। অমীমাংসিত বিরোধ বাংলাদেশের আইন ও ঢাকা আদালতের এখতিয়ারের অধীন।',
      },
      {
        icon: 'info',
        tag: 'conditions',
        heading: 'দায় সীমাবদ্ধতা',
        body:
          'প্রযোজ্য আইনে অনুমোদিত সর্বোচ্চ পরিমাণে, প্ল্যাটফর্ম ব্যবহার থেকে উদ্ভূত পরোক্ষ, আকস্মিক বা পরিণতিমূলক ক্ষতির জন্য Ocean Bazar দায়ী নয়।',
      },
      {
        icon: 'refresh',
        tag: 'info',
        heading: 'এই শর্তাবলির পরিবর্তন',
        body:
          'আমরা যেকোনো সময় এই শর্তাবলি আপডেট করতে পারি। পরিবর্তনের পর প্ল্যাটফর্ম ব্যবহার চালিয়ে যাওয়া সম্মতি হিসেবে গণ্য হবে। গুরুত্বপূর্ণ পরিবর্তন ইমেইল বা ইন-অ্যাপ নোটিফিকেশনের মাধ্যমে জানানো হবে।',
      },
    ],
  },

  warranty: {
    title: 'ওয়ারেন্টি পলিসি',
    lastUpdated: 'এপ্রিল ২০২৫',
    intro:
      'ওয়ারেন্টি কভারেজ পণ্যের ব্র্যান্ড, বিক্রেতার প্রতিশ্রুতি এবং প্রযোজ্য নির্মাতার শর্তের উপর নির্ভর করে। ক্রয়ের আগে সবসময় পণ্যের লিস্টিংয়ে নির্দিষ্ট ওয়ারেন্টি তথ্য দেখুন।',
    sections: [
      {
        icon: 'star',
        tag: 'eligibility',
        heading: 'ওয়ারেন্টির ধরন',
        body: 'Ocean Bazar-এর পণ্যে নিম্নলিখিত এক বা একাধিক ধরনের ওয়ারেন্টি থাকতে পারে:',
        bullets: [
          'ব্র্যান্ড / নির্মাতা ওয়ারেন্টি — ব্র্যান্ড সার্ভিস সেন্টারে সেবা',
          'সেলার ওয়ারেন্টি — বিক্রেতা কর্তৃক প্রতিস্থাপন বা মেরামত',
          'Ocean Bazar প্ল্যাটফর্ম ওয়ারেন্টি — নির্বাচিত পণ্য ক্যাটাগরির জন্য',
        ],
        highlight: 'ওয়ারেন্টির ধরন ও সময়কাল পণ্যের পেজে তালিকাভুক্ত। ক্রয়ের আগে দেখে নিন।',
      },
      {
        icon: 'ban',
        tag: 'conditions',
        heading: 'যা কভার হবে না',
        body: 'নিম্নলিখিত ক্ষেত্রে ওয়ারেন্টি দাবি বাতিল:',
        bullets: [
          'ডেলিভারির পর শারীরিক ক্ষতি (পড়ে যাওয়া, ফাটল, বাঁকা)',
          'পানি বা আর্দ্রতাজনিত ক্ষতি',
          'অনুমোদনহীন মেরামত, পরিবর্তন বা ডিভাইস খোলা',
          'অনুপযুক্ত বিদ্যুৎ ব্যবহারে বৈদ্যুতিক ক্ষতি',
          'স্বাভাবিক ক্ষয়',
          'অপব্যবহার বা সুপারিশকৃত শর্তের বাইরে ব্যবহার',
        ],
      },
      {
        icon: 'package',
        tag: 'process',
        heading: 'ওয়ারেন্টি ক্লেইম করার উপায়',
        body: 'ওয়ারেন্টি ক্লেইম শুরু করতে:',
        bullets: [
          'অর্ডার ডিটেইল পেজ থেকে সাপোর্ট টিকেট খুলুন',
          'ক্যাটাগরি হিসেবে "ওয়ারেন্টি ক্লেইম" নির্বাচন করুন',
          'প্রদান করুন: অর্ডার আইডি, পণ্যের সিরিয়াল/IMEI নম্বর, সমস্যার বিবরণ',
          'ত্রুটি প্রদর্শন করে পরিষ্কার ছবি বা সংক্ষিপ্ত ভিডিও সংযুক্ত করুন',
          'আমাদের টিম যাচাই করে ক্লেইমটি যথাযথ সার্ভিস পক্ষে পাঠাবে',
        ],
      },
      {
        icon: 'clock',
        tag: 'timeline',
        heading: 'ওয়ারেন্টি সার্ভিসের সময়',
        body: 'ক্লেইম ধরন অনুযায়ী সময়সীমা ভিন্ন:',
        bullets: [
          'Ocean Bazar টিমের ক্লেইম পর্যালোচনা: ১–২ কর্মদিবস',
          'ব্র্যান্ড সার্ভিস সেন্টার মেরামত: ৭–২১ কর্মদিবস (ব্র্যান্ড অনুযায়ী ভিন্ন)',
          'সেলার-পরিচালিত প্রতিস্থাপন: ৩–৭ কর্মদিবস',
          'যন্ত্রাংশ পাওয়া না গেলে: ৩০ দিন পর্যন্ত — আপনাকে জানানো হবে',
        ],
      },
    ],
  },
};

export const POLICY_ORDER: PolicyKey[] = ['privacy', 'returns', 'refunds', 'shipping', 'terms', 'warranty'];

export function getPolicies(locale: string): Record<PolicyKey, PolicyDocument> {
  return locale === 'bn' ? BN_POLICIES : EN_POLICIES;
}
