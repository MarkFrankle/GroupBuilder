import {
  Lightbulb,
  AlertTriangle,
  Info,
  ArrowUp,
} from "lucide-react";

function Screenshot({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className="my-6 bg-slate-50 rounded-lg p-4 border border-slate-200">
      <img
        src={src}
        alt={alt}
        className="rounded border border-slate-200 shadow-sm mx-auto max-w-2xl w-full"
      />
      <figcaption className="text-sm text-slate-500 text-center mt-3 italic">
        {caption}
      </figcaption>
    </figure>
  );
}

function TipCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-blue-50 border-l-4 border-blue-200 rounded p-4 my-4 flex gap-3">
      <Lightbulb className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-blue-900">{children}</div>
    </div>
  );
}

function WarningCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-50 border-l-4 border-amber-200 rounded p-4 my-4 flex gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-amber-900">{children}</div>
    </div>
  );
}

function InfoCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-slate-50 border-l-4 border-slate-200 rounded p-4 my-4 flex gap-3">
      <Info className="h-5 w-5 text-slate-500 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  );
}

const tocItems = [
  { id: "getting-started", label: "Getting Started" },
  { id: "creating-your-roster", label: "Creating Your Roster" },
  { id: "generating-groups", label: "Generating Groups" },
  { id: "viewing-your-groups", label: "Viewing Your Groups" },
  { id: "printing-and-sharing", label: "Printing & Sharing" },
  { id: "editing-sessions", label: "Editing Sessions" },
  { id: "troubleshooting", label: "Troubleshooting" },
];

function HelpPage() {
  return (
    <div className="min-h-screen bg-white print:bg-white">
      <div className="max-w-[700px] mx-auto px-4 py-8 sm:py-12">
        <h1 className="text-3xl font-bold mb-2">Group Builder Help</h1>
        <p className="text-slate-600 mb-8">
          A step-by-step guide to creating balanced small groups for your seminar
          series. If you get stuck at any point, check the{" "}
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

        {/* ===================== Section 1: Getting Started ===================== */}
        <section className="mb-12">
          <h2 id="getting-started" className="text-2xl font-bold mb-4 scroll-mt-8">
            Getting Started
          </h2>

          <h3 className="text-xl font-semibold mb-2">What is Group Builder?</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Group Builder helps you create balanced small groups for a seminar series.
            If you have, say, 20 participants meeting over 5 weekly sessions, Group
            Builder will assign them to tables each week so that everyone gets to sit
            with as many different people as possible. It takes into account gender,
            religion, couples, and facilitator assignments to make sure each table is
            diverse and well-led.
          </p>

          <h3 className="text-xl font-semibold mb-2">Signing in for the first time</h3>
          <p className="mb-2 text-slate-700 leading-relaxed">
            Your administrator will send you an invitation email. Here's what to expect:
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-slate-700 leading-relaxed mb-4">
            <li>
              Open the invitation email and click the link inside. This takes you to
              Group Builder and shows you which organization you've been invited to.
            </li>
            <li>
              You'll be asked to sign in. Enter your email address and click{" "}
              <strong>"Send me a login link."</strong>
            </li>
            <li>
              Check your email for the login link (it may take a minute). Click it to
              sign in. There's no password to remember — this is a one-time setup.
            </li>
            <li>
              After signing in, you'll be taken back to accept the invitation. Click{" "}
              <strong>"Accept Invite"</strong> and you're in. From now on, you'll stay
              signed in — you shouldn't need to do this again.
            </li>
          </ol>

          <h3 className="text-xl font-semibold mb-2">Finding your way around</h3>
          <p className="mb-2 text-slate-700 leading-relaxed">
            Once you're signed in, you'll see a navigation bar at the top of every page
            with three links:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-slate-700 leading-relaxed mb-4">
            <li>
              <strong>Home</strong> — Your starting point. From here you can manage
              your roster, import from a spreadsheet, or view previous results.
            </li>
            <li>
              <strong>Roster</strong> — Where you add and edit your list of participants.
            </li>
            <li>
              <strong>Groups</strong> — Browse all previously created group assignments,
              sorted by most recent.
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
            participants are. There are two ways to do this.
          </p>

          <h3 className="text-xl font-semibold mb-2">Using the Roster Manager</h3>
          <p className="mb-2 text-slate-700 leading-relaxed">
            Click <strong>Roster</strong> in the nav bar (or <strong>"Manage
            Roster"</strong> on the Home page) to open the roster manager. You'll see
            a spreadsheet-like table where you can add and edit participants one by one.
          </p>

          <p className="mb-1 text-slate-700 leading-relaxed font-bold">Adding a participant:</p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            There's always an empty row at the bottom of the list. Type a name into it,
            then press Tab or click somewhere else. The participant is saved automatically.
            A new empty row appears for the next person.
          </p>

          <p className="mb-1 text-slate-700 leading-relaxed font-bold">Setting details:</p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Each participant has a <strong>Religion</strong> dropdown (Christian, Jewish,
            Muslim, or Other) and a <strong>Gender</strong> dropdown (Male, Female, or
            Other). These are used when balancing the tables — every table will
            have an even mix of religions and genders.
          </p>

          <p className="mb-1 text-slate-700 leading-relaxed font-bold">Setting partners (couples):</p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            If two participants are a couple, use the <strong>Partner</strong> dropdown
            on either person's row to link them. You only need to do this on one person —
            the other person updates automatically. The solver will make sure partners are
            always placed at <em>different</em> tables, so they each meet new people.
          </p>

          <p className="mb-1 text-slate-700 leading-relaxed font-bold">Marking facilitators:</p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            If someone will be leading table discussions, check the{" "}
            <strong>Facilitator</strong> box on their row. The solver ensures at least one
            facilitator at every table. You can mark more facilitators than tables — if
            you have 6 facilitators for 4 tables, some tables will get two.
          </p>

          <p className="mb-1 text-slate-700 leading-relaxed font-bold">Deleting a participant:</p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Hover over a participant's row and a trash icon will appear on the right.
            Click it to remove them.
          </p>

          <InfoCallout>
            Your roster saves automatically as you type. You'll see a small "Saving..."
            indicator at the top that changes to "Saved" when everything is up to date.
          </InfoCallout>

          <Screenshot
            src="/images/help/roster-management.png"
            alt="The roster manager showing several participants with their religion, gender, partner, and facilitator settings"
            caption="The roster manager with participants, their details, partner links, and facilitator checkboxes"
          />

          <h3 className="text-xl font-semibold mt-8 mb-2">Importing from Excel</h3>
          <p className="mb-2 text-slate-700 leading-relaxed">
            If you already have your participant list in a spreadsheet, you can import
            it instead of typing everyone in by hand.
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-slate-700 leading-relaxed mb-4">
            <li>
              On the Home page, click <strong>"Download Template with Sample Data"</strong>{" "}
              to get an Excel file showing the expected format.
            </li>
            <li>
              Open the template, replace the sample data with your participants, and save
              the file. Keep the column headers as they are.
            </li>
            <li>
              Back on the Home page, click <strong>"Import from Excel"</strong> and select
              your file. Your participants will be loaded into the roster.
            </li>
          </ol>
          <p className="mb-4 text-slate-700 leading-relaxed">
            After importing, you can always go to the Roster page to make corrections —
            fix a name, change a religion, add a partner pairing, and so on.
          </p>

          <Screenshot
            src="/images/help/home-page-ui.png"
            alt="The Home page with Manage Roster and Import from Excel options, plus a Download Template link"
            caption="The Home page — your starting point for managing participants and importing data"
          />
        </section>

        {/* ===================== Section 3: Generating Groups ===================== */}
        <section className="mb-12">
          <h2 id="generating-groups" className="text-2xl font-bold mb-4 scroll-mt-8">
            Generating Groups
          </h2>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Once your roster is ready, it's time to create your groups. At the bottom
            of the Roster page, you'll see two dropdowns and a Generate button.
          </p>

          <p className="mb-1 text-slate-700 leading-relaxed font-bold">
            Number of Tables
          </p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            This is how many groups you want per session. If you have 20 participants
            and choose 4 tables, each table will have about 5 people.
          </p>

          <p className="mb-1 text-slate-700 leading-relaxed font-bold">
            Number of Sessions
          </p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            This is how many rounds of different groupings you need — typically one per
            week of your seminar. If your seminar runs for 5 weeks, choose 5 sessions.
            Each session will have a completely different arrangement so people meet new
            tablemates each week.
          </p>

          <p className="mb-4 text-slate-700 leading-relaxed">
            When you're ready, click <strong>Generate Assignments</strong>. The solver
            will spend about 2 minutes working out the best possible arrangement. You'll
            see a progress indicator while it works. When it's done, you'll be taken to
            the results page.
          </p>

          <WarningCallout>
            <p className="font-semibold mb-2">If something goes wrong:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>The Generate button is grayed out</strong> — You need more
                participants than tables. For example, if you chose 4 tables, you need
                at least 5 participants.
              </li>
              <li>
                <strong>"Need at least N facilitators for N tables"</strong> — You
                marked fewer facilitators than tables. Either go back and mark more
                people as facilitators, or reduce the number of tables.
              </li>
            </ul>
          </WarningCallout>
        </section>

        {/* ===================== Section 4: Viewing Your Groups ===================== */}
        <section className="mb-12">
          <h2 id="viewing-your-groups" className="text-2xl font-bold mb-4 scroll-mt-8">
            Viewing Your Groups
          </h2>
          <p className="mb-4 text-slate-700 leading-relaxed">
            After generating assignments, you'll land on the results page. There are
            two ways to view your groups. You'll see two small icons below the quality
            summary — a grid icon and a list icon. These switch between compact and
            detailed view.
          </p>

          {/* Compact View */}
          <h3 className="text-xl font-semibold mb-2">Compact View</h3>
          <p className="mb-2 text-slate-700 leading-relaxed">
            This is the default. It shows all sessions side by side in a grid, giving
            you a bird's-eye view of the entire seminar at once. Each person appears
            as a small colored chip with their name. Chips are color-coded by
            religion — blue for Jewish, red for Christian, green for Muslim, and
            yellow for Other — so you can see the religious mix at each table at a
            glance. A legend at the top shows which color maps to which religion.
          </p>
          <p className="mb-2 text-slate-700 leading-relaxed">
            A few things you can do here:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-slate-700 leading-relaxed mb-4">
            <li>
              <strong>Track someone across sessions:</strong> Click any person's name.
              Their chip will highlight in every session so you can trace their path
              through the seminar — who they sit with each week. Click again to
              deselect.
            </li>
            <li>
              <strong>See someone's details:</strong> Hover over any name to see a
              tooltip with their religion, gender, partner (if any), and whether
              they're a facilitator.
            </li>
            <li>
              <strong>Spot facilitators:</strong> Facilitators have a gold ring
              around their chip and bold text. Each table also lists its
              facilitators by name just above the chips (e.g. "Facilitators: Omar
              Hassan, Sarah Cohen").
            </li>
          </ul>

          <Screenshot
            src="/images/help/compact-view.png"
            alt="Compact view showing all sessions side by side, with David Cohen highlighted across every session"
            caption="Compact view — click any name to track them across sessions (here, David Cohen is highlighted)"
          />

          {/* Detailed View */}
          <h3 className="text-xl font-semibold mt-8 mb-2">Detailed View</h3>
          <p className="mb-2 text-slate-700 leading-relaxed">
            Click the list icon to switch to detailed view. This shows one session
            at a time, with a full card for each table. It's the view you'll use
            when you want to inspect a specific session closely, or when you want
            to make manual edits.
          </p>
          <p className="mb-2 text-slate-700 leading-relaxed">
            Each table card shows several pieces of information at a glance:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-slate-700 leading-relaxed mb-4">
            <li>
              <strong>Table header</strong> — Shows the table name on the left (e.g.
              "Table 1") and a summary on the right: total people, facilitator count,
              gender split (e.g. 3F/3M), and number of religions represented.
            </li>
            <li>
              <strong>Participant rows</strong> — Each person gets their own row showing
              their name in bold, color-coded religion and gender badges, and (if they
              have a partner) a heart icon with their partner's name.
            </li>
            <li>
              <strong>Partner warning</strong> — If partners end up at the same table
              (a constraint violation), the table header shows a{" "}
              <span className="text-red-600 font-medium">red warning triangle</span> and
              the heart icons next to their names turn red.
            </li>
            <li>
              <strong>Facilitator section</strong> — Facilitators are listed in their
              own "FACILITATORS" section at the bottom of each table card, with a
              green "Facilitator" badge alongside their religion and gender badges.
            </li>
          </ul>
          <p className="mb-4 text-slate-700 leading-relaxed">
            To move between sessions, use the <strong>Previous</strong> and{" "}
            <strong>Next</strong> buttons, or pick a session from the dropdown.
          </p>

          <Screenshot
            src="/images/help/detail-view-with-issue.png"
            alt="Detailed view of a single table card showing participant rows, religion and gender badges, partner hearts, a couple warning, and the facilitator section"
            caption="Detailed view — a table card showing participant details, partner links, a couple warning (red triangle), and the facilitator section at the bottom"
          />

          {/* Quality Summary */}
          <h3 className="text-xl font-semibold mt-8 mb-2">Understanding the Quality Summary</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            At the top of the results page, you'll always see a summary card that tells
            you how good the assignments are. This is the most important thing to check
            after generating groups. Here's what each line means:
          </p>

          <div className="space-y-4 mb-4">
            <div className="pl-4 border-l-2 border-slate-200">
              <p className="font-medium text-slate-800">Couples Separated</p>
              <p className="text-slate-700 text-sm leading-relaxed">
                A green checkmark means no partners were placed at the same table.
                Couples are always separated — this is guaranteed.
              </p>
            </div>
            <div className="pl-4 border-l-2 border-slate-200">
              <p className="font-medium text-slate-800">Religion Balanced</p>
              <p className="text-slate-700 text-sm leading-relaxed">
                Shows how evenly different religions are spread across tables. You'll
                see something like "±1" — that means no table has more than 1 extra
                person of any religion compared to other tables. Religion balance is
                always enforced.
              </p>
            </div>
            <div className="pl-4 border-l-2 border-slate-200">
              <p className="font-medium text-slate-800">Gender Balanced</p>
              <p className="text-slate-700 text-sm leading-relaxed">
                Same idea as religion balance, but for gender distribution. Gender
                balance is always enforced.
              </p>
            </div>
            <div className="pl-4 border-l-2 border-slate-200">
              <p className="font-medium text-slate-800">Facilitator Coverage</p>
              <p className="text-slate-700 text-sm leading-relaxed">
                Confirms every table has at least one facilitator to lead the discussion.
                If you designated extra facilitators (e.g. 6 facilitators for 4 tables),
                some tables will have more than one — that's fine.
              </p>
            </div>
            <div className="pl-4 border-l-2 border-slate-200">
              <p className="font-medium text-slate-800">Average Unique Tablemates</p>
              <p className="text-slate-700 text-sm leading-relaxed">
                This tells you, on average, how many <em>different</em> people each
                participant sits with across all sessions. Higher is better. For example,
                if someone sits with 4 people per session over 5 sessions and never
                repeats, they'd have 20 unique tablemates — the maximum. In practice,
                some repetition is unavoidable, so this number will be lower.
              </p>
            </div>
            <div className="pl-4 border-l-2 border-slate-200">
              <p className="font-medium text-slate-800">Repeated Pairs</p>
              <p className="text-slate-700 text-sm leading-relaxed">
                How many pairs of people end up at the same table more than once. Lower
                is better. This will never be zero — with a fixed number of tables,
                some repetition is mathematically unavoidable.
              </p>
            </div>
          </div>

          <p className="mb-2 text-slate-700 leading-relaxed">
            Overall, the summary shows either a green <strong>"Looks Good"</strong> or
            a yellow <strong>"Has Issues."</strong>
          </p>
          <ul className="list-disc pl-5 space-y-2 text-slate-700 leading-relaxed mb-4">
            <li>
              <strong>Green</strong> means all the hard constraints are satisfied (couples
              separated, facilitators at every table) and the balance metrics are within
              acceptable range.
            </li>
            <li>
              <strong>Yellow</strong> means something needs attention. Check which line
              has the issue — it might be that one table ended up with no facilitator,
              or two partners got placed together.
            </li>
          </ul>

          <Screenshot
            src="/images/help/validation-summary-looks-good.png"
            alt="Validation summary showing all green checkmarks: couples separated, religion balanced, gender balanced, all tables have facilitators, with Looks Good overall status"
            caption="The quality summary when everything looks good — all constraints satisfied"
          />
          <Screenshot
            src="/images/help/validation-summary-issues.png"
            alt="Validation summary showing a couple violation warning, with yellow Has Issues overall status"
            caption="The quality summary when there's a problem — here, one couple ended up at the same table"
          />

          <TipCallout>
            If the quality isn't great, don't worry — you have options. You can{" "}
            <strong>Regenerate All</strong> with a slower speed setting (the solver
            spends more time searching for better arrangements), regenerate just one
            problematic session, or make manual edits. All of these are covered in
            the <a href="#editing-sessions" className="text-blue-700 underline">Editing Sessions</a>{" "}
            section below.
          </TipCallout>
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

          <h3 className="text-xl font-semibold mb-2">Print Roster</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Click <strong>"Print Roster"</strong> to open a print-formatted page with
            every session's table assignments listed out (who's at which table), plus
            circular seating charts showing where each person sits. From there, use
            your browser's Print function (Ctrl+P on Windows, Cmd+P on Mac) or click
            the Print button on the page. This is great for handing out at the seminar.
          </p>

          <h3 className="text-xl font-semibold mb-2">Print Seating Charts</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            If you only need seating charts for a single session (for example, to put
            one on each table), switch to detailed view, navigate to the session you
            want, and click <strong>"Print Seating."</strong> This shows just the
            circular seating charts for that session's tables.
          </p>

          <h3 className="text-xl font-semibold mb-2">Copy Link</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Click <strong>"Copy Link"</strong> to copy a shareable URL to your
            clipboard. You can paste this into an email, text message, or group chat.
            Anyone with the link can view that specific version of the assignments — they'll
            need to be signed into Group Builder to see it. Links stay active as long
            as someone accesses them at least once every 30 days.
          </p>

          <Screenshot
            src="/images/help/print-roster-copy-link-print-seating.png"
            alt="The results page toolbar showing Print Roster, Copy Link, and version picker at the top, with Edit, Regenerate Session, and Print Seating controls below"
            caption="The results page controls — Print Roster and Copy Link in the top toolbar, with session-specific actions (Edit, Regenerate Session, Print Seating) below"
          />
        </section>

        {/* ===================== Section 6: Editing Sessions ===================== */}
        <section className="mb-12">
          <h2 id="editing-sessions" className="text-2xl font-bold mb-4 scroll-mt-8">
            Editing Sessions
          </h2>
          <p className="mb-4 text-slate-700 leading-relaxed">
            The generated assignments are a starting point. You can regenerate them
            entirely, redo a single session, or make fine-grained manual changes.
          </p>

          {/* Regenerate All */}
          <h3 className="text-xl font-semibold mb-2">Starting Over: Regenerate All</h3>
          <p className="mb-2 text-slate-700 leading-relaxed">
            If you want a completely fresh set of assignments, click the{" "}
            <strong>&#x22EF; menu</strong> (three dots) in the toolbar and choose{" "}
            <strong>"Regenerate All Sessions."</strong>
          </p>
          <p className="mb-2 text-slate-700 leading-relaxed">
            You'll be asked to pick a speed:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-700 leading-relaxed mb-4">
            <li>
              <strong>Fast</strong> (1 minute) — Good for a quick re-roll when you just
              want something different.
            </li>
            <li>
              <strong>Default</strong> (2 minutes) — The standard setting, same as the
              initial generation.
            </li>
            <li>
              <strong>Slow</strong> (4 minutes) — Gives the solver extra time to search
              for a better solution. Try this if you're not happy with the mixing quality.
            </li>
          </ul>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Your previous version is not lost. Every time you regenerate, the results
            are saved as a new version. You can switch between versions using the{" "}
            <strong>version dropdown</strong> in the toolbar — so if the new version is
            worse, you can always go back.
          </p>

          {/* Regenerate One Session */}
          <h3 className="text-xl font-semibold mt-8 mb-2">Fixing One Session: Regenerate Session</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Sometimes most sessions look great but one is off — maybe Session 3 has a
            couple at the same table, or the gender balance is uneven. In detailed view,
            navigate to the problem session and click <strong>"Regenerate Session."</strong>{" "}
            This re-runs the solver for just that one session (it's nearly instant)
            while keeping all other sessions exactly as they are.
          </p>

          {/* Edit Mode */}
          <h3 className="text-xl font-semibold mt-8 mb-2">Fine-Tuning: Edit Mode</h3>
          <p className="mb-4 text-slate-700 leading-relaxed">
            For precise control, you can manually move people between tables. In detailed
            view, navigate to the session you want to edit and click{" "}
            <strong>"Edit"</strong> in the toolbar.
          </p>

          <p className="mb-1 text-slate-700 leading-relaxed font-bold">Swapping two people:</p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Click on the person you want to move — they'll get a blue highlight. Then
            click on the person you want to swap them with. The two switch places
            instantly. You'll see the quality summary and table indicators update
            in real time, so you can tell whether the swap improved things or made
            them worse.
          </p>

          <InfoCallout>
            Facilitators can only be swapped with other facilitators, and regular
            participants can only be swapped with other regular participants. This
            ensures every table keeps its facilitator coverage.
          </InfoCallout>

          <p className="mb-1 text-slate-700 leading-relaxed font-bold">Marking someone absent:</p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            If someone can't make it to a particular session, click their name to select
            them, then click <strong>"Mark Absent."</strong> They'll be moved to an
            Absent section below the tables. If they can make it after all, click their
            name in the Absent section and then click any empty slot at a table to place
            them back.
          </p>

          <p className="mb-1 text-slate-700 leading-relaxed font-bold">Undoing changes:</p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            Made a swap you didn't like? Click <strong>Undo</strong> to step back. You
            can undo up to 10 changes. Each click undoes one action.
          </p>

          <p className="mb-1 text-slate-700 leading-relaxed font-bold">Saving your edits:</p>
          <p className="mb-4 text-slate-700 leading-relaxed">
            When you're done, click <strong>"Done Editing."</strong> Your changes are
            saved in your browser automatically. The next time you visit this page, you'll
            see a note saying <strong>"Viewing edited version"</strong> to remind you that
            manual changes are in effect. Keep in mind that these edits are stored locally
            in your browser — if you switch to a different computer or clear your browsing
            data, they'll be gone. To make changes permanent for everyone, use Regenerate
            to create a new saved version.
          </p>

          <Screenshot
            src="/images/help/edit-mode.png"
            alt="Edit mode showing a selected participant with green highlight, an absent participant section, empty slots at tables, and the Undo and Mark Absent buttons in the toolbar"
            caption="Edit mode — Raj Patel is marked absent, Carlos Rodriguez is selected (green border), and empty slots show where absent participants can be placed back"
          />
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
                This is normal — login links expire after 60 minutes for security. Go
                to the login page, enter your email, and you'll receive a fresh login
                link. Your data is safe; nothing is lost when you're logged out.
              </p>
            </InfoCallout>

            <InfoCallout>
              <p className="font-bold mb-1">"My session expired" or "I can't find my assignments"</p>
              <p>
                If you uploaded a roster via Excel import, that upload session lasts for
                1 hour. After that, go to the Home page and re-import your file, or
                rebuild your roster using the Roster Manager. If you previously generated
                assignments and saved them, click <strong>Groups</strong> in the nav bar
                to browse all your past group assignments.
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

            <InfoCallout>
              <p className="font-bold mb-1">"My manual edits disappeared"</p>
              <p>
                Manual edits (swaps, absent markings) are saved in your browser's local
                storage, not on the server. They'll disappear if you switch browsers,
                use a different computer, or clear your browsing data. If you want to
                preserve changes permanently, use the Regenerate function to create a
                new version that's saved on the server and visible to everyone.
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
