import type { Metadata } from "next";
import { formatPhoneForDisplay, getOwnerIdentity } from "@homereach/services/outreach";

export const metadata: Metadata = {
  title: "Privacy Policy — HomeReach",
  description: "HomeReach Privacy Policy",
};

export default function PrivacyPolicyPage() {
  const owner = getOwnerIdentity();
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: April 15, 2026</p>

      <div className="prose prose-gray max-w-none space-y-8 text-gray-700">

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">1. Who We Are</h2>
          <p>HomeReach ("we," "us," or "our") is a direct-mail advertising platform that helps local businesses reach verified homeowners through targeted postcard campaigns. Our website is <a href="https://home-reach.com" className="text-blue-600 hover:underline">home-reach.com</a>.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">2. Information We Collect</h2>
          <p>We collect information you provide when:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Signing up for an account or campaign</li>
            <li>Contacting us through our website or Facebook Page</li>
            <li>Messaging us on Facebook Messenger</li>
            <li>Filling out intake or checkout forms</li>
          </ul>
          <p className="mt-3">This may include your name, business name, email address, phone number, city, and business category.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">3. How We Use Facebook Messenger Data</h2>
          <p>When you message our HomeReach Facebook Page, we receive your Facebook name and the content of your messages. We use this information to:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Respond to your inquiries about our advertising services</li>
            <li>Qualify your business for our postcard campaigns</li>
            <li>Follow up if you expressed interest but did not complete your order</li>
            <li>Add you to our CRM system to track your interest and communication history</li>
          </ul>
          <p className="mt-3">We do not sell your Facebook data to third parties. We do not use Messenger data for advertising targeting outside of our own sales process.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">4. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Process your campaign orders and payments</li>
            <li>Communicate about your campaign status</li>
            <li>Send you follow-up messages related to services you inquired about</li>
            <li>Improve our products and services</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">5. Data Sharing</h2>
          <p>We do not sell, trade, or rent your personal information to third parties. We may share your information with:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li><strong>Stripe</strong> — for payment processing</li>
            <li><strong>Twilio</strong> — for SMS communication</li>
            <li><strong>Mailgun</strong> — for email delivery</li>
            <li><strong>Supabase</strong> — for secure data storage</li>
          </ul>
          <p className="mt-3">These providers are bound by their own privacy policies and data protection obligations.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">6. Data Retention</h2>
          <p>We retain your information for as long as necessary to provide our services and comply with legal obligations. You may request deletion of your data at any time by contacting us.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">7. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Access the personal information we hold about you</li>
            <li>Request correction of inaccurate information</li>
            <li>Request deletion of your information</li>
            <li>Opt out of marketing communications at any time</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">8. Cookies</h2>
          <p>Our website uses cookies to improve your browsing experience and analyze site traffic. You can control cookie settings through your browser preferences.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">9. Security</h2>
          <p>We implement industry-standard security measures including encryption in transit and at rest, access controls, and regular security reviews to protect your information.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">10. Contact Us</h2>
          <p>If you have questions about this Privacy Policy or how we handle your data, contact us at:</p>
          <div className="mt-2">
            <p><strong>HomeReach</strong></p>
            <p>Email: <a href={`mailto:${owner.domainEmail}`} className="text-blue-600 hover:underline">{owner.domainEmail}</a></p>
            <p>Phone: {formatPhoneForDisplay(owner.cellPhone)}</p>
            <p>Website: <a href="https://home-reach.com" className="text-blue-600 hover:underline">home-reach.com</a></p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">11. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by posting a notice on our website. Continued use of our services after changes constitutes acceptance of the updated policy.</p>
        </section>

      </div>
    </div>
  );
}
