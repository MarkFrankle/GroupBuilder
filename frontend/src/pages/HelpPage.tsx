import { ArrowUp } from "lucide-react";
import { Screenshot, WarningCallout, InfoCallout } from "../components/HelpCallouts";

const tocItems = [
  { id: "welcome-to-group-builder", label: "Welcome to Group Builder" },
  { id: "creating-your-roster", label: "Creating Your Roster" },
  { id: "viewing-your-groups", label: "Viewing Your Assignments" },
  { id: "printing-and-sharing", label: "Printing & Sharing" },
  { id: "editing-sessions", label: "Changing a Session" },
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

        {/* ===================== Section 3: Viewing Your Assignments ===================== */}
        <section className="mb-12">
          <h2 id="viewing-your-groups" className="text-2xl font-bold mb-4 scroll-mt-8">
            Viewing Your Assignments
          </h2>
          <p className="mb-4 text-slate-700 leading-relaxed">
            After generating, you land on the Assignments page. Every session is on
            this one page, stacked from Session 1 downward — there is no view to
            switch to and no session to navigate to. Scroll and you see the whole
            program.
          </p>

          <h3 className="text-xl font-semibold mb-2">Reading the page</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            At the top is your program name and its facts: how many participants,
            tables and sessions, and the average number of different people each
            participant sits with across the program. Below that, a{" "}
            <strong>Rules</strong> line lists the linked pairs you have set up.
          </p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Just below that, a banner checks the plan against the rules you set —
            couples seated apart, anyone you asked to keep apart kept apart, a
            facilitator at every table — and either tells you it's ready to print
            or names what to fix and in which session.
          </p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Each session is a card. Inside it, each table lists its facilitators
            first, then everyone else, with a summary on the right: how many people
            are seated, the gender split, and how many religions are represented.
            Name colours show religion.
          </p>

          <h3 className="text-xl font-semibold mt-8 mb-2">Full and Compact</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            On the right of the view controls row is a <strong>Full / Compact</strong>{" "}
            switch. <strong>Compact</strong> shrinks everything and lays the sessions out
            side by side so you can see the whole program at once — useful for checking it
            looks right and for following one person across every session. Compact is
            read-only: the session buttons are hidden and completed sessions show inline
            with the rest. Switch back to <strong>Full</strong> to change anything. The
            view is not saved — reloading the page puts you back in Full.
          </p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Clicking a person's name (in either view) highlights them everywhere they
            appear across every session, so you can trace who they sit with over the
            course of the program.
          </p>

          <h3 className="text-xl font-semibold mt-8 mb-2">Marking a session complete</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            When a meeting night has happened, press <strong>Mark complete</strong> in
            that session's header. The session collapses to a single line and moves
            below the sessions still ahead of you, under a <strong>Completed</strong>{" "}
            heading — so the next night to run is always the first thing on the page.
            Press the arrow on a completed line to look at who sat where.
          </p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            A completed session cannot be changed. Shuffling it, editing it, or
            rebuilding the program are all refused — the past stays as it happened.
            If you marked one complete by mistake, press <strong>Reopen</strong> on
            it, or press <strong>Undo</strong> on the line that appears at the top
            right after you mark complete — both put the session back the way it was.
          </p>

          <InfoCallout>
            <p>
              Sessions are completed in order, because time runs in order. You can
              only complete the next session that is still open, and only reopen the
              most recently completed one. If you try to skip ahead, the app tells you
              which session is still open.
            </p>
          </InfoCallout>
        </section>


        {/* ===================== Section 5: Printing & Sharing ===================== */}
        <section className="mb-12">
          <h2 id="printing-and-sharing" className="text-2xl font-bold mb-4 scroll-mt-8">
            Printing & Sharing
          </h2>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Once you're happy with the assignments, you'll probably want to print them
            out or share them with others.
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
            If you only need seating charts for a single session (for example, to put
            one on each table), press <strong>"Print"</strong> in that session's
            header. This shows just the circular seating charts for that session's
            tables.
          </p>

          <h3 className="text-xl font-semibold mb-2">Copy Link</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            If another facilitator has a Group Builder account, you can share
            assignments directly: click <strong>"Copy Link"</strong> to copy a
            shareable URL to your clipboard and send it to them. They'll need to be
            signed into Group Builder to view it. Links stay active as long as
            someone accesses them at least once every 30 days. For facilitators who
            don't have Group Builder accounts, use the PDF method above instead.
          </p>

        </section>

        {/* ===================== Section 6: Changing a Session ===================== */}
        <section className="mb-12">
          <h2 id="editing-sessions" className="text-2xl font-bold mb-4 scroll-mt-8">
            Changing a Session
          </h2>
          <p className="mb-4 text-slate-700 leading-relaxed">
            The generated assignments are a starting point. Nothing changes unless you
            press something — the app never re-runs the solver on its own.
          </p>

          <h3 className="text-xl font-semibold mb-2">Shuffle one session</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Press <strong>Shuffle</strong> in a session's header to redo just that
            night. The solver still knows about every other session, so it avoids
            pairings people have already had — and it changes only the session you
            pressed. Anyone you have marked absent for that session stays absent.
          </p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Afterwards a line appears at the top telling you what happened: how many
            people moved, which sessions were left alone, and how many pairs now sit
            together more than once. If barely anyone moved, the arrangement you had
            was already close to the best one — shuffle again if you want a bigger
            change.
          </p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            That same line offers <strong>Undo</strong>. Pressing it puts back the
            arrangement you had before the shuffle. It stays available until you do
            something else, and even after it is gone you can bring any earlier
            arrangement back through History.
          </p>

          <h3 className="text-xl font-semibold mt-8 mb-2">
            Someone didn't come
          </h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Click a person's name anywhere on the page and they light up in every
            session, so you can see where they sit all series. While they are lit up,
            a <strong>Mark [name] absent</strong> button appears above their table.
            Press it and they move to the Absent list under that session.
          </p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Their chair is left empty rather than filled in — the app will not reshuffle
            the table behind your back. Only that one session changes, and the line at
            the top says so, with an <strong>Undo</strong> if you clicked the wrong
            person. Click anywhere else, or press Escape, to stop highlighting someone.
          </p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            If they turn up after all — or you marked the wrong person — click their
            name in the <strong>Absent</strong> list and press{" "}
            <strong>Mark present</strong>. You will be asked which table to seat them
            at. The app suggests the empty chair their absence left, but it asks rather
            than deciding, because it cannot know where they actually sat. Filing
            someone at the wrong table is not a cosmetic mistake: later sessions are
            mixed to avoid repeating tablemates, so a wrong table means the app spends
            the rest of the series keeping them away from people they never met.
          </p>

          <h3 className="text-xl font-semibold mt-8 mb-2">Earlier versions</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Every change is saved as a new version, and nothing is overwritten. Press{" "}
            <strong>History</strong> at the top of the page to look at an earlier one.
            Each version is named for what created it — "Session 3 shuffled", "Manual
            edit" — with its date underneath.
          </p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            While you are looking at an older version the page is read-only — Shuffle
            and Mark complete disappear, and a line at the top offers{" "}
            <strong>Back to current</strong>. If you want that older arrangement back,
            press <strong>Promote</strong> and it becomes the current plan. Nothing is
            erased: promoting adds a new version rather than winding the history back,
            so you can always return to where you were.
          </p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Printing still works while you look at an older version. Because the printed
            sheet does not say which version it came from, you will be asked to confirm
            first.
          </p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            History goes back as far as your last change to Setup. Versions from before
            that change are still there to look at, under a divider, but they cannot be
            promoted — they were built for a different roster, and the list says how
            many of your current participants each one seats.
          </p>

          <WarningCallout>
            <p>
              Shuffling a session replaces what was there. If you preferred the
              previous arrangement, press <strong>Undo</strong> on the line at the top
              of the page — or, later, open History and press Promote.
            </p>
          </WarningCallout>
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

            <InfoCallout>
              <p className="font-bold mb-1">"I can't find my assignments"</p>
              <p>
                Click <strong>Groups</strong> in the nav bar to browse all your past
                group assignments.
              </p>
            </InfoCallout>

            <InfoCallout>
              <p className="font-bold mb-1">"The link I shared stopped working"</p>
              <p>
                Shared links expire if no one accesses them for 30 days. Generate
                your assignments again and share a new link using the Copy Link button.
              </p>
            </InfoCallout>

            <InfoCallout>
              <p className="font-bold mb-1">"Need at least N facilitators for N tables"</p>
              <p>
                You have fewer facilitators marked than the number of tables you chose.
                For example, if you set 4 tables, you need at least 4 facilitators. Go
                to the Roster page and check the Facilitator box on more people, or
                reduce the number of tables.
              </p>
            </InfoCallout>

            <InfoCallout>
              <p className="font-bold mb-1">"The Generate button is grayed out and I can't click it"</p>
              <p>
                You need more participants than tables. If you chose 4 tables, you need
                at least 5 participants. Either add more people on the Roster page or
                reduce the number of tables.
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
