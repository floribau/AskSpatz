# AskSpatz

AskSpatz revolutionizes procurement by deploying intelligent AI agents that negotiate with multiple vendors simultaneously on your behalf. Watch as autonomous agents compete, learn, and leverage each other's progress to secure the best deals—all while you monitor the action in real-time through a powerful, intuitive dashboard.

## Features

- **Autonomous AI Negotiation Agents**: AI-powered agents negotiate with vendors on your behalf
- **Multi-Vendor Negotiations**: Run parallel negotiations with multiple vendors simultaneously
- **Competitive Leverage**: Agents are aware of each other's negotiation states and use competitive leverage to push prices down by referencing better offers from other vendors
- **Real-Time Tracking**: Monitor negotiation progress, price changes, and communication logs in real-time
- **Vendor Behavior Learning**: Agents learn from past negotiations to improve future interactions
- **Offer Comparison**: Compare offers side-by-side with pros/cons analysis
- **Offer Acceptance Workflow**: Review and accept the best offer when negotiations complete

## Project Structure

```
AskSpatz/
├── backend/          # Node.js/Express backend with AI agents
│   └── src/
│       ├── agent.ts      # AI negotiation agent implementation
│       ├── index.ts      # Express API server
│       └── ...
└── frontend/         # React frontend application
    └── src/
        ├── pages/        # Main application pages
        └── components/   # Reusable UI components
```

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Supabase account and database
- Anthropic API key (for Claude AI)
- (Optional) Resend API key (for email notifications)

## Setup

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the `backend` directory with the following variables:
   ```env
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_KEY=your_supabase_anon_key
   ANTHROPIC_API_KEY=your_anthropic_api_key
   RESEND_API_KEY=your_resend_api_key (optional)
   RESEND_FROM_EMAIL=your_email@domain.com (optional)
   PORT=3001
   ```

4. Run the backend in development mode:
   ```bash
   npm run dev
   ```

   Or build and run in production:
   ```bash
   npm run build
   npm start
   ```

   The backend server will start on `http://localhost:3001` (or the port specified in your `.env` file).

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

   The frontend application will start on `http://localhost:5173` (default Vite port).

4. Build for production:
   ```bash
   npm run build
   ```

## Running the Application

1. **Start the backend server** (in `backend` directory):
   ```bash
   npm run dev
   ```

2. **Start the frontend server** (in `frontend` directory, in a new terminal):
   ```bash
   npm run dev
   ```

3. **Open your browser** and navigate to `http://localhost:5173`

## Environment Variables

### Backend (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_KEY` | Yes | Your Supabase anon/service key |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude AI |
| `RESEND_API_KEY` | No | Resend API key for email notifications |
| `RESEND_FROM_EMAIL` | No | Email address to send from (defaults to onboarding@resend.dev) |
| `PORT` | No | Backend server port (defaults to 3001) |

## API Endpoints

The backend provides the following main endpoints:

- `POST /api/negotiations/start` - Start a new negotiation with vendors
- `GET /api/negotiation-groups` - Get all negotiation groups
- `GET /api/negotiation-groups/:id` - Get detailed negotiation group information
- `POST /api/negotiation-groups/:id/accept-offer` - Accept a specific offer
- `GET /api/vendors` - Get all vendors
- `PUT /api/vendors/:id` - Update vendor behavior

## Development

- Backend uses TypeScript with Express
- Frontend uses React with TypeScript, Vite, and Tailwind CSS
- Real-time updates via polling (2-second intervals)
- AI agents use LangChain with Anthropic's Claude models

## License

ISC
