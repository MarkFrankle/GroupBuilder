# GroupBuilder

**Automated table assignment optimizer for multi-session interfaith dialogues and seminars.**

GroupBuilder helps event organizers create balanced, diverse table assignments across multiple sessions. Originally built for interfaith seminar series, it's useful for any event where you need to mix participants thoughtfully across sessions while respecting social dynamics.

## The Problem

Running multi-session dialogue events (interfaith dinners, community seminars, networking events) requires careful table assignments:

- **Diversity matters**: Each table should have balanced representation (religion, gender, background)
- **Couples need separation**: Partners should sit at different tables to encourage broader dialogue
- **Multiple sessions complicate things**: With 3-6 sessions, manually ensuring people meet new tablemates each time becomes combinatorially complex
- **Time is limited**: Event coordinators are volunteers with limited time for spreadsheet gymnastics

GroupBuilder solves this in seconds using constraint programming.

## Features

✅ **Intelligent assignment** - Uses Google OR-Tools CP-SAT solver to optimize table assignments
✅ **Diversity balancing** - Ensures even distribution of religions, genders across all tables
✅ **Couple separation** - Automatically seats partners at different tables
✅ **Multi-session optimization** - Minimizes repeat pairings across sessions (weighted toward early sessions)
✅ **Excel-based workflow** - Upload a spreadsheet, download assignments
✅ **Magic links** - Bookmarkable results URLs valid for 30 days
✅ **Input validation** - Clear error messages for invalid data
✅ **Fast** - Handles 100 participants, 10 tables, 6 sessions in under 2 minutes

## Quick Start

### Prerequisites

- **Frontend**: Node.js 16+, npm
- **Backend**: Python 3.10+, Poetry
- **Excel template**: Download from `/public/template.xlsx`

### 1. Backend Setup

```bash
# Install API dependencies
cd api
poetry install

# Install assignment solver dependencies
cd ../assignment_logic
poetry install

# Run the API server
cd ../api
poetry run uvicorn src.api.main:app --reload
```

API will be available at `http://localhost:8000`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm start
```

Frontend will open at `http://localhost:3000`

### 3. Upload Your Data

1. Download the Excel template from the app
2. Fill in participant data:
   - **Name**: Full name
   - **Religion**: Religious background (used for diversity balancing)
   - **Gender**: Gender identity (used for diversity balancing)
   - **Partner**: Name of partner (if applicable) - they'll be seated separately

3. Upload the file and configure:
   - **Number of tables**: 1-10 (based on your venue)
   - **Number of sessions**: 1-6 (number of dinners/meetings)
   - **Email** (optional): Get a bookmarkable link to results

4. Click "Generate Assignments" and wait (~5-120 seconds depending on complexity)

## Tech Stack

### Frontend
- **React 18.3** + **TypeScript** - Modern, type-safe UI
- **Tailwind CSS** - Utility-first styling
- **Radix UI** - Accessible component primitives
- **React Router** - Client-side routing
- Deployed on **Netlify**

### Backend
- **FastAPI** - Modern Python web framework
- **Pandas** - Excel file processing
- **Pydantic** - Request validation
- **Uvicorn/Gunicorn** - ASGI server

### Assignment Engine
- **Google OR-Tools** - Constraint programming solver (CP-SAT)
- **Custom optimization model** - Minimizes repeat pairings while respecting hard constraints

### Infrastructure (Recommended for Production)
- **Fly.io** - Backend hosting (free tier: 3 VMs, 160GB transfer/month)
- **Upstash Redis** - Session storage (free tier: 10k commands/day, 256MB)
- **SendGrid** - Email delivery for magic links (free tier: 100 emails/day)

## How It Works

GroupBuilder models table assignment as a **constraint satisfaction problem** (CSP):

### Decision Variables
- `x[participant, table, session]` → boolean: is this participant at this table in this session?

### Hard Constraints
1. Each participant sits at exactly one table per session
2. All tables have balanced size (within ±1 person)
3. No table has more than ±1 person of any religion compared to other tables
4. No table has more than ±1 person of any gender compared to other tables
5. Couples never sit at the same table

### Optimization Objective
Minimize weighted pairings across sessions:
- Weighted sum of all participant pairings across sessions
- Earlier sessions weighted more heavily (encourages meeting new people later)

### Solver
- **CP-SAT** (Constraint Programming - Satisfiability) from Google OR-Tools
- Timeout: 120 seconds (returns best solution found within time limit)
- Typical solve times:
  - 20 people, 4 tables, 3 sessions: ~1 second
  - 50 people, 5 tables, 6 sessions: ~30 seconds
  - 100 people, 10 tables, 6 sessions: ~2 minutes

## Project Structure

```
GroupBuilder/
├── frontend/              # React TypeScript UI
│   ├── src/
│   │   ├── pages/         # Landing page, results page
│   │   ├── components/    # Reusable UI components
│   │   └── App.tsx        # Main routing
│   └── package.json
│
├── api/                   # FastAPI backend
│   ├── src/api/
│   │   ├── main.py        # FastAPI app
│   │   ├── routers/       # Upload, assignments endpoints
│   │   └── utils/         # Data transformation
│   └── pyproject.toml
│
├── assignment_logic/      # Constraint solver
│   ├── src/assignment_logic/
│   │   ├── group_builder.py   # CP-SAT model
│   │   └── api_handler.py     # API wrapper
│   ├── tests/             # Solver test suite
│   └── pyproject.toml
│
└── README.md
```

## Configuration Limits

To ensure reasonable solve times, the following limits are enforced:

- **Tables**: 1-10
- **Sessions**: 1-6
- **Participants**: 200 max

These limits are based on the O(S × T × P²) complexity of the pairings objective. Larger problems may timeout.

## Development

### Running Tests

```bash
cd assignment_logic
poetry run pytest tests/ -v
```

Test coverage includes:
- Simple assignments
- Couple separation
- Balanced table sizes
- Multiple sessions
- Diversity distribution
- Solution quality validation

### Code Quality

The backend uses:
- **Black** - Code formatting
- **Flake8** - Linting
- **MyPy** - Type checking

```bash
cd assignment_logic
poetry run black src/
poetry run flake8 src/
poetry run mypy src/
```

## Deployment

### Option 1: Fly.io + Upstash (Recommended)

**Backend (Fly.io):**
```bash
cd api
fly launch
fly deploy
```

**Session Storage (Upstash Redis):**
1. Create free account at upstash.com
2. Create Redis database
3. Add `UPSTASH_REDIS_URL` to Fly secrets

**Frontend (Netlify):**
1. Connect GitHub repo to Netlify
2. Set build command: `cd frontend && npm run build`
3. Set publish directory: `frontend/build`
4. Add environment variable: `REACT_APP_API_BASE_URL=<your-fly-url>`

### Option 2: Docker (Alternative)

Docker support coming soon.

## Contributing

This is open-source software built for the public good. Contributions welcome!

**Areas for contribution:**
- Excel export functionality for generated assignments
- PDF generation for printable table cards
- Additional constraint types (dietary restrictions, accessibility needs)
- Performance optimizations for larger events
- Email delivery integration (SendGrid, etc.)
- Localization/internationalization

**To contribute:**
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`poetry run pytest`)
5. Commit with clear messages
6. Push and open a Pull Request

## Use Cases

GroupBuilder was originally built for interfaith dialogue seminars, but works for any event needing thoughtful group mixing:

- 🕊️ **Interfaith dialogues** - Balance religious backgrounds across tables
- 🏢 **Professional networking** - Mix industries, roles, seniority levels
- 🎓 **Educational seminars** - Diverse student discussion groups
- 🤝 **Community building** - Neighborhood dinners, civic engagement events
- 💼 **Corporate offsites** - Cross-functional team building

## Known Limitations

- **Large problems may timeout**: With >100 participants and 6 sessions, the solver may not find optimal solutions within 2 minutes. It will return the best feasible solution found.
- **No real-time collaboration**: Multiple organizers can't edit the same event simultaneously
- **In-memory storage**: Results expire after 30 days (use persistent storage like Redis for longer retention)
- **English only**: UI and error messages are currently English-only

## Roadmap

- [ ] Excel export of generated assignments
- [ ] Redis integration for production deployments
- [ ] Email delivery via SendGrid
- [ ] Downloadable PDF table cards
- [ ] User accounts and event history
- [ ] Additional balancing attributes (age, profession, etc.)
- [ ] Mobile-responsive results view
- [ ] Analytics dashboard (usage stats for administrators)

## License

MIT License - see LICENSE file for details.

This software is free to use, modify, and distribute. We encourage non-profits, religious organizations, and community groups to use it freely.

## Acknowledgments

Built with love for the interfaith dialogue community and all organizations working to bring diverse people together.

Special thanks to:
- The Google OR-Tools team for the excellent CP-SAT solver
- All the non-profit event coordinators who provided feedback and testing

## Support

- **Issues**: Please report bugs via [GitHub Issues](https://github.com/MarkFrankle/GroupBuilder/issues)
- **Questions**: Open a discussion in the GitHub Discussions tab
- **Email**: For private inquiries about large-scale deployments

---

*Made with care for communities building bridges through dialogue.*
