export default function LegalPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-sm text-gray-700 space-y-10">
      <h1 className="text-2xl font-bold text-gray-900">Legal</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Privacy Policy</h2>
        <p><strong>Last updated:</strong> February 2026</p>

        <p>
          GroupBuilder is operated by Mark Frankle ("we," "us"). This policy
          describes what data we collect and how we use it.
        </p>

        <h3 className="font-semibold text-gray-900 pt-2">What we collect</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Email address</strong> — used for authentication (passwordless
            sign-in links) and organization invitations.
          </li>
          <li>
            <strong>Roster data you upload</strong> — participant names, gender,
            partner preferences, and facilitator status.
          </li>
          <li>
            <strong>Religious affiliation</strong> — we collect each participant's
            religion (e.g. Christian, Jewish, Muslim) because it is essential to
            the app's core function: generating balanced, interfaith table
            assignments. This is considered sensitive personal information. We
            collect it solely for this purpose and do not use it for any other
            reason.
          </li>
          <li>
            <strong>Generated assignments</strong> — the table/seating arrangements
            the app produces for you.
          </li>
        </ul>

        <h3 className="font-semibold text-gray-900 pt-2">How we protect it</h3>
        <p>
          All data is stored in Google Cloud (Firestore and Firebase
          Authentication), hosted in the United States. Data is transmitted over
          HTTPS. Access to roster and assignment data is restricted to
          authenticated members of your organization — it is not publicly
          accessible.
        </p>

        <h3 className="font-semibold text-gray-900 pt-2">What we don't do</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>We do not sell, share, or monetize your data.</li>
          <li>We do not use analytics, tracking cookies, or third-party advertising.</li>
          <li>We do not access your data except to operate and maintain the service.</li>
        </ul>

        <h3 className="font-semibold text-gray-900 pt-2">Data retention</h3>
        <p>
          Assignment results are retained for 30 days. Roster data and your
          account persist until you or your organization administrator request
          deletion. To request deletion, contact us at the email below.
        </p>

        <h3 className="font-semibold text-gray-900 pt-2">Data breach notification</h3>
        <p>
          In the event of a data breach affecting your personal information —
          including religious affiliation — we will notify affected users and
          their organization administrators by email as soon as reasonably
          practicable after becoming aware of the breach. The notification will
          describe what data was affected and what steps we are taking in
          response.
        </p>

        <h3 className="font-semibold text-gray-900 pt-2">Contact</h3>
        <p>
          Questions about your data? Email{" "}
          <a href="mailto:group-builder@frankle.fyi" className="underline text-blue-600">
            group-builder@frankle.fyi
          </a>.
        </p>
      </section>

      <hr className="border-gray-200" />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Terms of Service</h2>
        <p><strong>Last updated:</strong> February 2026</p>

        <h3 className="font-semibold text-gray-900 pt-2">Intellectual property</h3>
        <p>
          GroupBuilder is owned by Mark Frankle. All rights reserved. Nothing in
          these terms grants you any ownership interest in the software, its
          code, or its design.
        </p>

        <h3 className="font-semibold text-gray-900 pt-2">Your use of the service</h3>
        <p>
          By using GroupBuilder you agree to the following:
        </p>

        <ul className="list-disc pl-5 space-y-1">
          <li>
            You may use GroupBuilder to create and manage table assignments for
            your organization's events.
          </li>
          <li>
            You are responsible for the accuracy of the roster data you upload.
            Do not upload data you are not authorized to use.
          </li>
          <li>
            Roster data may include sensitive personal information such as
            religious affiliation. By uploading this data, you confirm that you
            have the consent of the individuals listed or are otherwise
            authorized to provide it.
          </li>
          <li>
            The service is provided "as is" without warranty. We do our best to
            keep it running but make no uptime guarantees.
          </li>
          <li>
            We may modify or discontinue the service at any time.
          </li>
          <li>
            We reserve the right to terminate accounts that misuse the service.
          </li>
        </ul>
      </section>
    </div>
  );
}
