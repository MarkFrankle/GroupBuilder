import { ArrowUp } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Screenshot, TipCallout, WarningCallout, InfoCallout } from "../../components/HelpCallouts";

const tocItems = [
  { id: "getting-started", label: "Getting Started as an Admin" },
  { id: "creating-a-program", label: "Creating a Program" },
  { id: "managing-a-program", label: "Managing a Program" },
  { id: "deleting-a-program", label: "Deleting a Program" },
  { id: "onboarding-facilitators", label: "Onboarding a New Facilitator" },
  { id: "logins-and-access", label: "Logins, Sharing, and Who Can See What" },
  { id: "quick-reference", label: "Common Admin Tasks" },
  { id: "troubleshooting", label: "Troubleshooting" },
];

export function AdminHelpPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">
            <Link to="/admin" className="hover:underline">GroupBuilder Admin</Link>
          </h1>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin">← Back to Dashboard</Link>
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-[700px] mx-auto px-4 py-8 sm:py-12">
        <h1 className="text-3xl font-bold mb-2">Admin Help</h1>
        <p className="text-slate-600 mb-8">
          A guide to managing programs and onboarding facilitators. If something
          isn't working as expected, see the{" "}
          <a href="#troubleshooting" className="text-blue-600 hover:text-blue-800 underline">
            Troubleshooting
          </a>{" "}
          section at the bottom.
        </p>

        {/* Table of Contents */}
        <nav className="mb-12 p-4 bg-slate-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">Contents</h2>
          <ul className="space-y-1.5">
            {tocItems.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="text-blue-600 hover:text-blue-800 underline text-sm"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* ===================== Section 1: Getting Started ===================== */}
        <section className="mb-12">
          <h2 id="getting-started" className="text-2xl font-bold mb-4 scroll-mt-8">
            Getting Started as an Admin
          </h2>
          <p className="mb-4 text-slate-700 leading-relaxed">
            The admin panel is where you create and manage <strong>programs</strong> —
            each program represents one cohort or session series run by a set
            of facilitators.
          </p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Admin access is managed by Mark on a per-case basis. If you need someone
            added or removed, just ask him.
          </p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            To reach the admin panel, click the <strong>Admin</strong> link on
            the right side of the navigation bar, or go directly to{" "}
            <a href="https://group-builder.com/admin" className="text-blue-600 hover:text-blue-800 underline">
              group-builder.com/admin
            </a>. The admin panel is entirely separate from the facilitator interface.
          </p>

          <InfoCallout>
            Admin access and facilitator access are independent. You can be an admin
            without being a member of any program, and vice versa. Being an admin
            lets you manage programs — it does not give you access to the roster
            or group assignment tools that facilitators use.
          </InfoCallout>

          <TipCallout>
            If you want to see the roster and group assignments for a program,
            invite yourself as a facilitator using your own email address. Admin
            access alone doesn't include facilitator tools.
          </TipCallout>
        </section>

        {/* ===================== Section 2: Creating a Program ===================== */}
        <section className="mb-12">
          <h2 id="creating-a-program" className="text-2xl font-bold mb-4 scroll-mt-8">
            Creating a Program
          </h2>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Click <strong>"+ Create Program"</strong> from the dashboard to open
            the creation form.
          </p>

          <ol className="list-decimal pl-5 space-y-3 text-slate-700 leading-relaxed mb-6">
            <li>
              <strong>Series Name</strong> — This is the name facilitators will see when
              they log in and choose which cohort to work on. Be specific: use something
              like "Springfield Dialogue Series — Spring 2026" rather than just "Spring 2026."
              Maximum 100 characters.
            </li>
            <li>
              <strong>Facilitator Emails</strong> — Enter one email address per line.
              These are the people who will receive invitations. You can add as many as
              you need, and you don't have to invite everyone at creation time — you can
              add more later from the Manage screen.
            </li>
            <li>
              Click <strong>"Create &amp; Send Invites."</strong>
            </li>
            <li>
              A confirmation screen appears showing each email address with a checkmark
              (sent) or an X (failed). If any failed, a manual invite link is shown —
              copy it and send it to the facilitator yourself.
            </li>
          </ol>

          <WarningCallout>
            If an email fails to send, the program is still created and the
            facilitator still has an invite — it just wasn't delivered automatically.
            Do not re-create the program. Use the manual link shown on the
            confirmation screen, or go to Manage → Add New Invite.
          </WarningCallout>

          <Screenshot
            src="/images/help-admin/create-organization-modal.png"
            alt="The Create Program form showing the Series Name field and the multi-line Facilitator Emails textarea"
            caption="The Create Program form — enter a specific series name and one email per line"
          />

          <Screenshot
            src="/images/help-admin/organization-created-confirmation.png"
            alt="Post-creation confirmation showing the program name and two sent invites with green checkmarks"
            caption="After creation — each invited email shows a green checkmark when successfully sent"
          />
        </section>

        {/* ===================== Section 3: Managing a Program ===================== */}
        <section className="mb-12">
          <h2 id="managing-a-program" className="text-2xl font-bold mb-4 scroll-mt-8">
            Managing a Program
          </h2>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Click <strong>"Manage"</strong> on any program card to open the
            management panel. It has two sections:
          </p>

          <h3 className="text-xl font-semibold mb-2">Members</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            People who have already accepted an invite and have active access. Each row
            shows their email, the date they joined, and their role. You can{" "}
            <strong>Remove</strong> a member at any time — they'll lose access to the
            program immediately but can be re-invited later.
          </p>

          <h3 className="text-xl font-semibold mb-2">Invites</h3>
          <p className="mb-2 text-slate-700 leading-relaxed">
            A full history of every invitation sent for this program. Each invite
            shows the invited email, when it was sent, and its status:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-slate-700 leading-relaxed mb-4">
            <li><strong>Pending</strong> — sent but not yet accepted; expires on the date shown</li>
            <li><strong>Accepted</strong> — the person clicked the link and joined</li>
            <li><strong>Expired</strong> — the link was not used before the expiry date</li>
            <li><strong>Revoked</strong> — you cancelled it manually</li>
            <li><strong>Removed</strong> — the person was removed from the program after accepting</li>
          </ul>
          <p className="mb-4 text-slate-700 leading-relaxed">
            You can <strong>Revoke</strong> any pending invite before it's accepted.
            Expired invites can't be used — you'd need to send a new one.
          </p>

          <h3 className="text-xl font-semibold mb-2">Add New Invite</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            At the top of the Invites section there's a single-email form. Enter an
            email and click <strong>"Send Invite"</strong> to add a new facilitator to
            an existing program without going through the Create flow.
          </p>

          <InfoCallout>
            Removing a member does not delete any of the work they did in the
            program (roster edits, generated groups, etc.). It only removes
            their access.
          </InfoCallout>

          <Screenshot
            src="/images/help-admin/manage-organization-modal.png"
            alt="The Manage modal showing the Members section with a Remove button, the Invites section with mixed statuses, and the Add New Invite form"
            caption="The Manage panel — Members, Invites (with status history), and the Add New Invite form"
          />
        </section>

        {/* ===================== Section 4: Deleting a Program ===================== */}
        <section className="mb-12">
          <h2 id="deleting-a-program" className="text-2xl font-bold mb-4 scroll-mt-8">
            Deleting a Program
          </h2>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Click <strong>"Delete"</strong> on a program card to soft-delete it.
            The program disappears from the default list, but all its data (roster,
            assignments, results) is preserved in the database.
          </p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            To see deleted programs, check <strong>"Show deleted programs"</strong>{" "}
            at the top of the dashboard. Deleted programs appear grayed-out with a
            "Deleted" badge. They cannot be managed or re-activated from the UI — if you
            need to recover one, contact whoever manages the backend.
          </p>

          <WarningCallout>
            There is no undo for this action. The confirmation dialog is the only
            safeguard. Double-check the name before clicking Delete.
          </WarningCallout>

          <Screenshot
            src="/images/help-admin/delete-organization-modal.png"
            alt="The delete confirmation dialog asking to confirm deleting a program"
            caption="The delete confirmation dialog — check the name carefully before confirming"
          />
        </section>

        {/* ===================== Section 5: Onboarding a New Facilitator ===================== */}
        <section className="mb-12">
          <h2 id="onboarding-facilitators" className="text-2xl font-bold mb-4 scroll-mt-8">
            Onboarding a New Facilitator: What They'll Experience
          </h2>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Here is the full flow from the facilitator's perspective, so you know what
            to tell them and how to troubleshoot if something goes wrong.
          </p>

          <div className="space-y-8 text-slate-700">

            {/* Step 1 */}
            <div>
              <p className="leading-relaxed mb-2">
                <span className="font-semibold">1. The invitation email</span> arrives
                from GroupBuilder with the subject "You're invited to facilitate [program
                name] on GroupBuilder." It shows who sent the invite — your email
                address appears as "Invited by" — and contains an "Accept Invitation"
                button.
              </p>
              <Screenshot
                src="/images/help-admin/facilitator-invite-email.png"
                alt="The invitation email showing the program name, Invited by field, and Accept Invitation button"
                caption="The invitation email — facilitators see who invited them and can click Accept Invitation"
              />
            </div>

            {/* Steps 2–3 */}
            <div>
              <p className="leading-relaxed mb-2">
                <span className="font-semibold">2. Clicking the button</span> takes them
                to the invite acceptance page. They'll see a "You're Invited!" screen
                showing the program name and the email address the invite was sent
                to, confirming they're in the right place.
              </p>
              <p className="leading-relaxed mb-2">
                <span className="font-semibold">3. They click "Accept Invite."</span>{" "}
                After a brief loading state, they see "Invite Accepted!" and are
                automatically taken into the app.
              </p>
              <Screenshot
                src="/images/help-admin/accept-facilitator-invite-page.png"
                alt="The invite acceptance page showing the program name, invited email, and a green Accept Invite button"
                caption="The acceptance page — program name, their email, and the green Accept Invite button"
              />
              <InfoCallout>
                <p className="font-semibold mb-1">Email mismatch warning</p>
                If a facilitator clicks the link but is already signed into GroupBuilder
                with a <em>different</em> email, they'll see a warning and the Accept
                button will be disabled. They need to click "Sign In with Different
                Email" and use the address the invite was sent to.
              </InfoCallout>
            </div>

            {/* Steps 4–5 */}
            <div>
              <p className="leading-relaxed mb-2">
                <span className="font-semibold">4. First time in the app</span> — they
                land on the Home page for the program they just joined. If they
                were invited to multiple programs, they'll see a selector first.
              </p>
              <p className="leading-relaxed mb-2">
                <span className="font-semibold">5. Staying logged in</span> — the app
                keeps them logged in in their browser, so they won't need to sign in
                again on that device. The invite link only works once. If they ever do
                need to log in again (new browser, cleared cookies), they go to the
                login page, enter their email, and receive a fresh sign-in link that
                expires after 60 minutes if unused.
              </p>
              <TipCallout>
                Tell new facilitators to bookmark the app after their first login —
                they won't need the invite email again.
              </TipCallout>
            </div>

          </div>
        </section>

        {/* ===================== Section 6: Logins, Sharing, and Who Can See What ===================== */}
        <section className="mb-12">
          <h2 id="logins-and-access" className="text-2xl font-bold mb-4 scroll-mt-8">
            Logins, Sharing, and Who Can See What
          </h2>

          <h3 className="text-xl font-semibold mb-2">Each facilitator needs their own login</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            GroupBuilder uses email-based magic links — there are no passwords to share.
            Each person who needs access must have their own email address in the system
            and must log in via their own email. If two people need access, invite both
            of them.
          </p>

          <h3 className="text-xl font-semibold mb-2">Multiple facilitators can be logged in at the same time</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            There is no concept of "one person at a time." If two facilitators from the
            same program both have the app open, they are both looking at the same
            shared data: the same roster, the same generated groups, the same assignment
            history. Either of them can make changes. This is intentional — it supports
            co-facilitation and delegation.
          </p>

          <h3 className="text-xl font-semibold mb-2">Facilitators only see their own program's data</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Access is scoped strictly to the programs a facilitator has been invited
            to and accepted. A facilitator in "Spring 2026 Cohort" cannot see anything in
            "Fall 2025 Cohort" unless they were separately invited to that program.
            Admins can see all programs in the admin panel, but only for management
            purposes — the admin panel doesn't give roster or group access.
          </p>

          <h3 className="text-xl font-semibold mb-2">The expected ownership model</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            The typical setup is one facilitator per program who "owns" the tool —
            they build the roster, run the solver, and manage the results. Additional
            facilitators can be invited (e.g., a co-facilitator or backup) and will have
            full equal access. There is no read-only role; all invited facilitators can
            edit.
          </p>

          <TipCallout>
            If you're inviting a co-facilitator purely so they can view assignments
            (not edit), there's no lightweight way to do that right now — anyone you
            invite gets full edit access. The workaround is to share a link to the
            results page using the Copy Link button in the app. No login is required
            to view a shared link.
          </TipCallout>

          <InfoCallout>
            The app keeps facilitators logged in in their browser, so they should rarely
            need to sign in again after the first time. The session ends if they
            explicitly sign out, clear their browser data, or switch to a new browser
            or device. If they do need to log in again, they go to the login page,
            enter their email, and receive a fresh sign-in link; that link expires after
            60 minutes if unused,
            but clicking it re-establishes a persistent session just like before.
          </InfoCallout>
        </section>

        {/* ===================== Section 7: Quick Reference ===================== */}
        <section className="mb-12">
          <h2 id="quick-reference" className="text-2xl font-bold mb-4 scroll-mt-8">
            Common Admin Tasks
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-slate-700 border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left p-3 border border-slate-200 font-semibold">Task</th>
                  <th className="text-left p-3 border border-slate-200 font-semibold">Where to do it</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Create a new cohort", "Dashboard → \"+ Create Program\""],
                  ["Add a facilitator to an existing cohort", "Dashboard → Manage → Add New Invite"],
                  ["See if a facilitator accepted their invite", "Dashboard → Manage → Invites (check status)"],
                  ["Re-send an invite (if expired)", "Dashboard → Manage → Add New Invite (same email)"],
                  ["Remove a facilitator's access", "Dashboard → Manage → Members → Remove"],
                  ["Cancel an invite before it's accepted", "Dashboard → Manage → Invites → Revoke"],
                  ["See soft-deleted programs", "Dashboard → check \"Show deleted programs\""],
                ].map(([task, where], i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="p-3 border border-slate-200">{task}</td>
                    <td className="p-3 border border-slate-200 font-mono text-xs">{where}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ===================== Section 8: Troubleshooting ===================== */}
        <section className="mb-12">
          <h2 id="troubleshooting" className="text-2xl font-bold mb-4 scroll-mt-8">
            Troubleshooting
          </h2>

          <div className="space-y-4">
            <InfoCallout>
              <p className="font-bold mb-1">An invite email failed to send</p>
              <p>
                The program was still created and the invite link exists. Use the
                manual link shown in the post-creation dialog, or go to Manage → Add
                New Invite with the same address.
              </p>
            </InfoCallout>

            <InfoCallout>
              <p className="font-bold mb-1">A facilitator says the link doesn't work</p>
              <p>
                Invite links expire after 7 days. Check the status in Manage → Invites.
                If it's Expired, send a new invite using Add New Invite.
              </p>
            </InfoCallout>

            <InfoCallout>
              <p className="font-bold mb-1">A facilitator is signed in but can't see the program</p>
              <p>
                They may not have clicked Accept Invite. Have them check their original
                invitation email, or send a new invite via Manage → Add New Invite.
              </p>
            </InfoCallout>

            <InfoCallout>
              <p className="font-bold mb-1">A facilitator clicked the link but got a "wrong email" warning</p>
              <p>
                They were already signed into GroupBuilder with a different email. They
                need to click "Sign In with Different Email" on the invite page and sign
                in using the address the invite was sent to.
              </p>
            </InfoCallout>

            <InfoCallout>
              <p className="font-bold mb-1">I can't find a program I created</p>
              <p>
                Check "Show deleted programs" on the dashboard. If it appears there,
                it was soft-deleted. Data is intact; UI recovery isn't currently
                supported — contact your system administrator.
              </p>
            </InfoCallout>

            <InfoCallout>
              <p className="font-bold mb-1">Two facilitators edited the roster at the same time and something looks wrong</p>
              <p>
                The app has no real-time conflict detection. If two people edit
                simultaneously, the last write wins. Check the roster and correct it
                manually. For anything consequential (running the solver, making manual
                edits to assignments), coordinate so only one person is working at a time.
              </p>
            </InfoCallout>

            <InfoCallout>
              <p className="font-bold mb-1">I need to grant admin access to someone</p>
              <p>Ask Mark.</p>
            </InfoCallout>
          </div>
        </section>

        {/* Back to top */}
        <div className="text-center border-t border-slate-200 pt-6">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 underline text-sm bg-transparent border-none cursor-pointer"
          >
            <ArrowUp className="h-4 w-4" />
            Back to top
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminHelpPage;
