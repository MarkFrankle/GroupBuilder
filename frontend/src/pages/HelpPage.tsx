import { ArrowUp } from "lucide-react";
import { Screenshot, WarningCallout, InfoCallout } from "../components/HelpCallouts";

const tocItems = [
  { id: "welcome-to-group-builder", label: "Welcome to Group Builder" },
  { id: "creating-your-roster", label: "Creating Your Roster" },
  { id: "viewing-your-groups", label: "Reading Your Assignments" },
  { id: "running-your-sessions", label: "Running Your Sessions" },
  { id: "reading-the-banner", label: "How Good Are the Assignments: Reading the Banner" },
  { id: "editing-sessions", label: "Changing a Plan" },
  { id: "troubleshooting", label: "Troubleshooting" },
];

function HelpPage() {
  return (
    <div className="min-h-screen bg-white print:bg-white">
      <div className="max-w-[700px] mx-auto px-4 py-8 sm:py-12">
        <h1 className="text-3xl font-bold mb-2">Group Builder Help</h1>
        <p className="text-slate-600 mb-8">
          A step-by-step guide to creating balanced small groups for your
          program. If you get stuck at any point, check the{" "}
          <a href="#troubleshooting" className="text-blue-600 hover:text-blue-800 underline">
            Troubleshooting
          </a>{" "}
          section at the bottom.
        </p>

        {/* Table of Contents */}
        <nav className="mb-12 p-4 bg-slate-50 rounded-lg print:bg-white print:border print:border-slate-200">
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

        {/* ===================== Section 1: Welcome to Group Builder ===================== */}
        <section className="mb-12">
          <h2 id="welcome-to-group-builder" className="text-2xl font-bold mb-4 scroll-mt-8">
            Welcome to Group Builder
          </h2>

          <h3 className="text-xl font-semibold mb-2">What is Group Builder?</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Group Builder helps you create balanced small groups for a program.
            If you have, say, 20 participants meeting over 5 weekly sessions, Group
            Builder will assign them to tables each week so that everyone gets to sit
            with as many different people as possible. It takes into account gender,
            religion, couples, and facilitator assignments to make sure each table is
            diverse and well-led.
          </p>

          <h3 className="text-xl font-semibold mb-2">Finding your way around</h3>
          <p className="mb-2 text-slate-700 leading-relaxed">
            Once you're signed in, you'll see a navigation bar at the top of every page
            with a few links:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-slate-700 leading-relaxed mb-4">
            <li>
              <strong>Home</strong> — Your starting point. Cards link to Roster,
              Assignments, and Help.
            </li>
            <li>
              <strong>Roster</strong> — Where you add and edit your list of participants.
            </li>
            <li>
              <strong>Assignments</strong> — Browse the groups Group Builder has generated
              for you, sorted by session. This link appears once you've built your first
              set of groups.
            </li>
            <li>
              <strong>Help</strong> — This page.
            </li>
          </ul>

        </section>

        {/* ===================== Section 2: Creating Your Roster ===================== */}
        <section className="mb-12">
          <h2 id="creating-your-roster" className="text-2xl font-bold mb-4 scroll-mt-8">
            Creating Your Roster
          </h2>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Before you can generate groups, you need to tell Group Builder who your
            participants are.
          </p>

          <Screenshot
            src="/images/help/roster-management.png"
            alt="The roster manager showing several participants with their religion, gender, partner, and facilitator settings"
            caption="The roster manager with participants, their details, partner links, and facilitator checkboxes"
          />

          <h3 className="text-xl font-semibold mb-2">Using the Roster Manager</h3>
          <p className="mb-2 text-slate-700 leading-relaxed">
            Click <strong>Roster</strong> in the nav bar to open the roster manager.
            You'll see a spreadsheet-like table where you can add and edit participants
            one by one.
          </p>

          <p className="mb-1 text-slate-700 leading-relaxed font-bold">Adding a participant:</p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            As you enter a participant's information, a new empty row will appear
            for the next person and the roster will save automatically.
          </p>

          <p className="mb-1 text-slate-700 leading-relaxed font-bold">Setting details:</p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Each participant has a <strong>Religion</strong> dropdown (Christian, Jewish,
            Muslim, or Other) and a <strong>Gender</strong> dropdown (Male, Female, or
            Other). These are used when balancing the tables: every table will
            have an even mix of religions and genders.
          </p>

          <p className="mb-1 text-slate-700 leading-relaxed font-bold">Setting partners (couples):</p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            If two participants are a couple, use the <strong>Partner</strong> dropdown
            on either person's row to link them. You only need to do this on one person.
            The other person updates automatically. By default, the solver will place
            partners at <em>different</em> tables so they each meet new people.
          </p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            If a couple needs to stay <strong>together</strong> at the same table (for
            example, for health or accessibility reasons), click the{" "}
            <strong>link icon</strong> next to the partner name. The icon toggles
            between separated (unlink icon) and together (link icon). When linked,
            both partners will always be assigned to the same table in every session.
          </p>

          <p className="mb-1 text-slate-700 leading-relaxed font-bold">Marking facilitators:</p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Facilitators get added just like regular participants, but should be
            indicated by checking the <strong>Facilitator</strong> box on their row.
            The solver ensures at least one facilitator at every table, and you need
            at least as many facilitators as tables. Building groups is blocked
            until you have enough. You can mark more facilitators than tables. If
            you have 6 facilitators for 4 tables, some tables will get two.
          </p>

          <p className="mb-1 text-slate-700 leading-relaxed font-bold">Recording absences ahead of time:</p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            If you already know someone will miss a session or two, use the{" "}
            <strong>Absences</strong> column on their row and tick the sessions they'll
            miss. The first build works around those absences. After you've built your
            sessions, absences are managed per session on the Assignments page instead,
            and the Absences column becomes a read-only summary.
          </p>

          <p className="mb-1 text-slate-700 leading-relaxed font-bold">Deleting a participant:</p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Hover over a participant's row and a trash icon will appear on the right.
            Click it to remove them.
          </p>

          <p className="mb-1 text-slate-700 leading-relaxed font-bold">Keeping people apart:</p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Sometimes two participants shouldn't share a table. Below the table and
            session counts, find the <strong>Keep apart</strong> section and click{" "}
            <strong>+ Add a pair</strong>. Choose two people from the dropdowns and
            they'll never be seated together in any session. Remove a pair you've
            added by clicking its remove icon. Partners do not appear as options to
            keep apart because they are kept apart by default.
          </p>

          <p className="mb-1 text-slate-700 leading-relaxed font-bold">Generating assignments:</p>
          <p className="mb-1 text-slate-700 leading-relaxed">
            Once your roster is ready, scroll to the bottom of the Roster page to
            find <strong>Number of Tables</strong> and <strong>Number of
            Sessions</strong>.
          </p>
          <p className="mb-1 text-slate-700 leading-relaxed">
            <strong>Number of Tables</strong> is how many groups you want per
            session. If you have 20 participants and choose 4 tables, each table
            will have about 5 participants and at least 1 facilitator.
          </p>
          <p className="mb-1 text-slate-700 leading-relaxed">
            <strong>Number of Sessions</strong> is how many rounds of different
            groupings you need, typically one per week of your program. If your
            program runs for 5 weeks, choose 5 sessions. Each session will have a
            completely different arrangement so people meet new tablemates each
            week.
          </p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            When you're ready, click <strong>Generate assignments</strong>. The
            solver will spend about 2 minutes working out the best possible
            arrangement. You'll see a progress indicator while it works. When
            it's done, you'll be taken to the results page.
          </p>

          <h3 className="text-xl font-semibold mb-2">Editing after you've built groups</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Once you've generated a set of sessions, the roster <strong>locks</strong>:
            every field goes read-only and the header reads "Locked — these are the
            people your sessions were built from." This is deliberate. It keeps the
            roster from silently drifting away from the groups you already built.
          </p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            To make a change, click <strong>Edit roster</strong> at the top of the
            page. The grid, the table and session counts, and the Keep apart section
            all become editable again. As soon as you make a change, two buttons
            appear at the bottom:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-slate-700 leading-relaxed mb-4">
            <li>
              <strong>Save and rebuild sessions</strong>: Saves your edits and
              re-runs the solver to fold them into your sessions.
            </li>
            <li>
              <strong>Discard changes</strong>: Throws away everything you changed
              since unlocking and re-locks the roster, unchanged.
            </li>
          </ul>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Editing the roster doesn't touch your existing sessions by itself.
            Nothing changes until you click <strong>Save and rebuild sessions</strong>.
          </p>

          <h4 className="text-lg font-semibold mb-2">Rebuilding while the program is ongoing</h4>
          <p className="mb-4 text-slate-700 leading-relaxed">
            If you've already held at least one session and need to change the
            roster, you can rebuild your assignments without changing history.
            Make sure all past sessions are{" "}
            <a href="#marking-sessions-complete" className="text-blue-600 hover:text-blue-800 underline">
              marked complete
            </a>{" "}
            before clicking <strong>Save and rebuild sessions</strong>. Group
            Builder will build groups for the remaining sessions using your
            updated roster, leaving your completed sessions exactly as they
            were. It still remembers who already sat together in those
            sessions, so it won't seat the same pair twice just because the
            rebuild started fresh.
          </p>
          <WarningCallout>
            <p>
              When the rebuild finishes, a banner appears at the top of the
              page with two buttons: <strong>Accept</strong> and{" "}
              <strong>Undo</strong>. Nothing else on the page works until you
              press one. Look over the new sessions first. <strong>Accept</strong>{" "}
              locks them in; <strong>Undo</strong> throws the rebuild away and
              restores the sessions you had before. This is the only thing
              standing between you and overwriting sessions that haven't run
              yet, so Group Builder won't let you move on without deciding.
            </p>
          </WarningCallout>
        </section>

        {/* ===================== Section 3: Reading Your Assignments ===================== */}
        <section className="mb-12">
          <h2 id="viewing-your-groups" className="text-2xl font-bold mb-4 scroll-mt-8">
            Reading Your Assignments
          </h2>
          <p className="mb-4 text-slate-700 leading-relaxed">
            After generating, you land on the Assignments page. Every session is on
            this one page in chronological order.
          </p>

          <h3 className="text-xl font-semibold mb-2">Reading the page</h3>

          <Screenshot
            wide
            src="/images/help/assignments-header.png"
            alt="The top of the Assignments page: program name and print/copy-link/history buttons, a green plan-check banner, and a row with a Religion/Gender/Couples color legend and a Full/Compact switch"
            caption="The top of the Assignments page"
          />

          <ul className="list-disc pl-5 space-y-2 text-slate-700 leading-relaxed mb-4">
            <li>
              <strong>Top left:</strong> your program name.
            </li>
            <li>
              <strong>Top right:</strong> print the roster and seating charts,
              copy a shareable link, or open History.
            </li>
            <li>
              <strong>The green (or amber, or gray) box</strong> is the plan-check
              banner — see{" "}
              <a href="#reading-the-banner" className="text-blue-600 hover:text-blue-800 underline">
                How Good Are the Assignments
              </a>{" "}
              below for what each color means.
            </li>
            <li>
              <strong>Bottom left:</strong> switch names between colored by
              Religion, Gender, or Couples — the legend next to it shows what each
              color means.
            </li>
            <li>
              <strong>Bottom right:</strong> the Full / Compact switch, covered next.
            </li>
          </ul>

          <p className="mb-4 text-slate-700 leading-relaxed">
            Below this, each session is a card. Inside it, each table lists its
            facilitators first, then everyone else, with a summary on the right:
            how many people are seated, the gender split, and how many religions
            are represented.
          </p>

          <h3 className="text-xl font-semibold mt-8 mb-2">Full and Compact</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            <strong>Compact</strong> shrinks everything and lays the sessions out
            side by side so you can see the whole program at once — useful for checking it
            looks right and for following one person across every session.
          </p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Clicking a person's name (in either view) highlights them everywhere they
            appear across every session, so you can trace who they sit with over the
            course of the program.
          </p>

        </section>

        {/* ===================== Section 4: Running Your Sessions ===================== */}
        <section className="mb-12">
          <h2 id="running-your-sessions" className="text-2xl font-bold mb-4 scroll-mt-8">
            Running Your Sessions
          </h2>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Once a set of assignments exists, these are the things you'll do every
            week regardless of what the banner says: hand out seating charts and
            mark off each session as it happens.
          </p>

          <h3 className="text-xl font-semibold mb-2">Print roster &amp; seating charts</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Click <strong>"Print roster &amp; seating charts"</strong> to open a print-formatted page with
            every session's table assignments listed out (who's at which table), plus
            circular seating charts showing where each person sits. From there, use
            your browser's Print function (Ctrl+P on Windows, Cmd+P on Mac) or click
            the Print button on the page.
          </p>

          <p className="mb-1 text-slate-700 leading-relaxed font-bold">Saving as PDF to share by email:</p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            To send the assignments to other facilitators, you can save them as a
            PDF: click <strong>"Print roster &amp; seating charts"</strong>, then in the print dialog
            instead of choosing a printer, choose{" "}
            <strong>"Save as PDF."</strong> This will create and download a PDF file
            you can rename if desired and attach to an email or share however you
            like.
          </p>

          <h3 className="text-xl font-semibold mb-2">Print Seating Charts</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            If you only need to print a single session, press <strong>"Print"</strong>
            in that session's header. This shows just the roster and 
            circular seating charts for that session's tables.
          </p>

          <h3 className="text-xl font-semibold mb-2">Copy Link</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            If another facilitator has a Group Builder account, you can share
            assignments directly: click <strong>"Copy Link"</strong> to copy a
            shareable URL to your clipboard and send it to them. They'll need to be
            signed into Group Builder to view it. For facilitators who
            don't have Group Builder accounts, use the PDF method above instead.
          </p>

          <h3 className="text-xl font-semibold mt-8 mb-2">Marking a session complete</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            When a meeting night has happened, press <strong>Mark complete</strong> in
            that session's header. The session collapses to a single line and moves
            below the sessions still ahead of you, under a <strong>Completed</strong>{" "}
            heading so the next night to run is always the first thing on the page.
            Press the arrow on a completed line to expand the session and look at who sat where.
          </p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            A completed session cannot be changed. Shuffling it and editing it are refused,
            the past stays as it happened. If you complete any sessions and then change your 
            roster and rebuild assignments, the completed sesssions will stay as they were.
            If you marked one complete by mistake, press <strong>Reopen</strong> on
            it, or press <strong>Undo</strong> on the line that appears at the top
            right after you mark complete.
          </p>
        </section>

        {/* ===================== Section 5: How Good Are the Assignments ===================== */}
        <section className="mb-12">
          <h2 id="reading-the-banner" className="text-2xl font-bold mb-4 scroll-mt-8">
            How Good Are the Assignments: Reading the Banner
          </h2>
          <p className="mb-4 text-slate-700 leading-relaxed">
            The banner near the top of the page checks the quality of the assignments
            and tells you whether it's ready to print. It's the fastest way to know
            whether you need to do anything before you hand these out, and if so, what.
          </p>

          <h3 className="text-xl font-semibold mb-2">Green: ready to print</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Shown above in{" "}
            <a href="#viewing-your-groups" className="text-blue-600 hover:text-blue-800 underline">
              Reading Your Assignments
            </a>
            . Every rule is satisfied and mixing is as good as this roster allows.
            Nothing to do but print and go.
          </p>

          <h3 className="text-xl font-semibold mb-2">Gray: good enough, not ideal</h3>

          <Screenshot
            wide
            src="/images/help/grey-banner.png"
            alt="A gray plan-check banner: the three hard rules pass, but a pair sits together three times, two tables share 3 people, and one person has the same facilitator 3 of 5 sessions"
            caption="Good enough to print, but not ideal"
          />

          <p className="mb-4 text-slate-700 leading-relaxed">
            Every rule is satisfied, but the groups aren't perfect. A pair sits
            together more than once, one facilitator sees the same person in several
            sessions, or two tables share more people than expected.
            Hover over the <strong>(?)</strong> next to a line like this to see exactly
            who's affected and in which sessions.
          </p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            This plan is printable as-is. If you want to improve it, the <strong>(?)</strong> will
            say which sessions need your attention. Press <strong>Shuffle</strong> on a
            session if you want to try for something better. Shuffling a session will give new
            table assignments for that session while minimizing repeats in other sessions.
          </p>

          <h3 className="text-xl font-semibold mb-2">Amber: fix before you print</h3>

          <Screenshot
            wide
            src="/images/help/amber-banner.png"
            alt="An amber plan-check banner: Session 1 Table 2 has no facilitator, and Session 1 isn't mixed as evenly by religion as the roster allows"
            caption="A few things to check before you print"
          />

          <p className="mb-4 text-slate-700 leading-relaxed">
            A hard rule has been violated: a couple is seated together, a pair who must be
            kept apart ended up at the same table, a table has no facilitator, or
            a session's religion or gender mix is worse than this roster allows.
            Each line names which session and table.
          </p>
        </section>

        {/* ===================== Section 6: Changing a Plan ===================== */}
        <section className="mb-12">
          <h2 id="editing-sessions" className="text-2xl font-bold mb-4 scroll-mt-8">
            Changing Assignments
          </h2>

          <h3 className="text-xl font-semibold mb-2">Shuffle one session</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Press <strong>Shuffle</strong> in a session's header to remake just that
            night. The solver still knows about every other session, so it avoids
            pairings people have already had and it changes only the session you
            pressed. Anyone you have marked absent for that session stays absent.
          </p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Afterwards a line appears at the top telling you what happened: how many
            people moved, which sessions were left alone, and how many pairs now sit
            together more than once. That same line offers <strong>Undo</strong>.
            Pressing it puts back the arrangement you had before the shuffle.
          </p>

          <h3 className="text-xl font-semibold mt-8 mb-2">
            Marking someone absent
          </h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Click a person's name anywhere on the page and they light up in every
            session, so you can see where they sit across the whole series. While they are lit up,
            a <strong>Mark [name] absent</strong> button appears above their table.
            Press it and they move to the Absent list at the bottom of that session.
          </p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            If they turn up after all (or you marked the wrong person) click their
            name in the <strong>Absent</strong> list and press{" "}
            <strong>Mark present</strong>. You will be asked which table to seat them
            at. The app suggests the empty chair their absence left.
          </p>

          <h3 className="text-xl font-semibold mt-8 mb-2">Earlier versions of your assignments</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Every time the plan changes, the previous version is stored. Press{" "}
            <strong>History</strong> at the top of the page to look at an earlier one.
            Each version is named for what created it, eg. "Session 3 shuffled", "Manual
            edit", with its date underneath.
          </p>

          <Screenshot
            src="/images/help/version-history.png"
            alt="The History panel open beneath the History button, listing versions like 'Skyler Cohen marked present in Session 3' and 'Session 1 shuffled' with their timestamps"
            caption="The History panel, most recent version first"
          />

          <p className="mb-4 text-slate-700 leading-relaxed">
            While you are looking at an older version the page is read-only: Shuffle
            and Mark complete disappear, and a line at the top offers{" "}
            <strong>Back to current</strong>. If you prefer the historical pairings,
            press <strong>Promote</strong> and it becomes the current plan. Nothing is
            erased: promoting adds a new version rather than winding the history back,
            so you can always return to where you were.
          </p>

          <Screenshot
            wide
            src="/images/help/promote-back-to-current.png"
            alt={`A banner reading "You're viewing 'Skyler Cohen marked present in Session 2' from Sep 12, 4:46 PM" with Promote, Back to current, and close buttons`}
            caption="The banner shown while viewing an earlier version"
          />
          <p className="mb-4 text-slate-700 leading-relaxed">
            Printing still works while you look at an older version. Because the printed
            sheet does not say which version it came from, you will be asked to confirm
            first.
          </p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            History goes back as far as your last change to the Roster. Versions from before
            that change are still there to look at, under a divider, but they cannot be
            promoted because they were built for a different roster.
          </p>

        </section>


        {/* ===================== Section 7: Troubleshooting ===================== */}
        <section className="mb-12">
          <h2 id="troubleshooting" className="text-2xl font-bold mb-4 scroll-mt-8">
            Troubleshooting
          </h2>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Here are solutions to the most common issues:
          </p>

          <div className="space-y-6">
            <InfoCallout>
              <p className="font-bold mb-1">"I got logged out" or "I need to sign in again"</p>
              <p>
                This is normal — login links expire after 60 minutes for security.
                Click <strong>Logout</strong> in the top right corner, then enter your
                email to receive a fresh login link. Your data is safe; nothing is
                lost when you're logged out.
              </p>
            </InfoCallout>

          </div>
        </section>

        {/* Back to top */}
        <div className="text-center border-t border-slate-200 pt-6">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
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

export default HelpPage;
