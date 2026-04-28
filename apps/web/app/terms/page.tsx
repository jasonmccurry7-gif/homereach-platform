import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms & Conditions — HomeReach",
  description: "HomeReach Terms of Service and SMS / Text Messaging Program Terms",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms &amp; Conditions</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: April 27, 2026</p>

      <div className="prose prose-gray max-w-none space-y-8 text-gray-700">

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">1. Agreement to Terms</h2>
          <p>By accessing or using <a href="https://home-reach.com" className="text-blue-600 hover:underline">home-reach.com</a> (the &ldquo;Site&rdquo;) or any HomeReach service, you agree to be bound by these Terms &amp; Conditions and our <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>. If you do not agree, do not use the Site or services.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">2. Services</h2>
          <p>HomeReach is a direct-mail advertising platform that helps local home-service businesses reach verified homeowners through targeted postcard campaigns. We may also provide related communication services such as email and SMS for campaign setup, follow-up, and customer support.</p>
        </section>

        <section className="border-2 border-blue-300 bg-blue-50 rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-3">3. SMS / Text Messaging Program</h2>
          <p className="font-semibold text-gray-900">Program Name: HomeReach Sales &amp; Customer Communications</p>

          <p className="mt-4"><strong>Program Description.</strong> By providing your mobile phone number to HomeReach (whether through our website intake forms, checkout, Facebook inquiry, in-person request, or by replying to a HomeReach communication), you consent to receive SMS / text messages from HomeReach related to: information about our direct-mail advertising program, availability of exclusive city/category slots, follow-up on inquiries you initiated, campaign status updates, payment links for orders you have requested, renewal reminders, and customer support replies.</p>

          <p className="mt-4"><strong>Message Frequency.</strong> Message frequency varies based on your activity. You will typically receive between 1 and 6 messages per inquiry or active campaign.</p>

          <p className="mt-4"><strong>Message &amp; Data Rates.</strong> Message and data rates may apply. Standard messaging rates from your wireless carrier will apply to messages sent and received. HomeReach is not responsible for any carrier fees you incur.</p>

          <p className="mt-4"><strong>Opt-In.</strong> You opt in to the program by submitting your phone number on a HomeReach intake or contact form, by texting our number first, by replying to a HomeReach message with consent, or by verbally consenting on a recorded sales call. We will never add a phone number to the SMS program without an opt-in.</p>

          <p className="mt-4"><strong>Opt-Out (HOW TO STOP MESSAGES).</strong> You can cancel the SMS program at any time. Reply <strong>STOP</strong> (or UNSUBSCRIBE, CANCEL, END, or QUIT) to any message you receive from HomeReach. After you reply STOP, you will receive one final confirmation message and then no further SMS will be sent from HomeReach. If you wish to rejoin, reply <strong>START</strong> (or YES, UNSTOP).</p>

          <p className="mt-4"><strong>Help (HOW TO GET HELP).</strong> Reply <strong>HELP</strong> to any HomeReach message for assistance, or contact us directly:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Email: <a href="mailto:jason@home-reach.com" className="text-blue-600 hover:underline">jason@home-reach.com</a></li>
            <li>Phone: <a href="tel:+13303044916" className="text-blue-600 hover:underline">(330) 304-4916</a></li>
          </ul>

          <p className="mt-4"><strong>Carrier Disclaimer.</strong> Carriers (including Verizon, AT&amp;T, T-Mobile, US Cellular, and others) are not liable for delayed or undelivered messages.</p>

          <p className="mt-4"><strong>Privacy.</strong> See our <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link> for details on how we handle your phone number and message content. <span className="font-semibold">HomeReach does not sell, rent, or share your mobile phone number or SMS opt-in information with any third party for marketing or promotional purposes.</span> Phone numbers are used only by HomeReach and our SMS delivery provider (Twilio) to operate the messaging program.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">4. Email Communications</h2>
          <p>By providing your email address, you consent to receive transactional and marketing emails from HomeReach related to our services. You may opt out of marketing emails at any time using the unsubscribe link in any email or by contacting <a href="mailto:jason@home-reach.com" className="text-blue-600 hover:underline">jason@home-reach.com</a>. Transactional emails (order confirmations, receipts, campaign status) will continue regardless of marketing opt-out status.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">5. Payments &amp; Orders</h2>
          <p>All orders are processed securely through Stripe. By placing an order, you authorize HomeReach to charge the payment method you provide. Refunds are governed by HomeReach&rsquo;s order-specific terms communicated at checkout. Subscriptions auto-renew at the cadence stated at the time of purchase unless cancelled before the next billing cycle.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">6. Acceptable Use</h2>
          <p>You agree not to misuse the Site or our services. Specifically, you will not:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Submit information that is fraudulent, misleading, or not yours to provide</li>
            <li>Attempt to interfere with the operation of the Site or its security</li>
            <li>Use HomeReach to send unlawful, harassing, or unsolicited messages</li>
            <li>Reverse engineer, scrape, or copy substantial portions of the Site</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">7. Intellectual Property</h2>
          <p>All content, branding, and software on the Site are owned by HomeReach or its licensors and are protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works without prior written consent.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">8. Disclaimers &amp; Limitation of Liability</h2>
          <p>The Site and services are provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis without warranties of any kind, express or implied. To the fullest extent permitted by law, HomeReach is not liable for indirect, incidental, special, or consequential damages arising out of your use of the Site or services. Our total liability for any claim is limited to the amount you paid HomeReach in the twelve (12) months preceding the claim.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">9. Changes to These Terms</h2>
          <p>We may update these Terms from time to time. Material changes will be posted on this page with a revised &ldquo;Last updated&rdquo; date. Continued use of the Site or services after changes are posted constitutes your acceptance of the updated Terms.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">10. Contact</h2>
          <div className="mt-2">
            <p><strong>HomeReach</strong></p>
            <p>Email: <a href="mailto:jason@home-reach.com" className="text-blue-600 hover:underline">jason@home-reach.com</a></p>
            <p>Phone: <a href="tel:+13303044916" className="text-blue-600 hover:underline">(330) 304-4916</a></p>
            <p>Website: <a href="https://home-reach.com" className="text-blue-600 hover:underline">home-reach.com</a></p>
          </div>
        </section>

      </div>
    </div>
  );
}
