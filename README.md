# Conclave — Multi-Agent Collaborative AI Chat

Conclave is a polished, browser-based multi-agent AI chat application that simulates collaborative conversations between configurable AI agents. Built with a Slack-style three-pane interface, it enables users to manage agent personas, orchestrate multi-agent responses, and maintain session persistence using Cloudflare Workers and Durable Objects. The application focuses on visual excellence, responsive design, and smooth interactions, leveraging shadcn/ui components and framer-motion for a delightful user experience.

## Key Features

- **Three-Pane Workspace**: Left navigation for agents and sessions, central chat composer and conversation area, right panel for live status and context summaries.
- **Agent Configuration**: Customize agent names, avatars, personalities (via sliders for formality, detail, approach, creativity), model selection, and behavior toggles.
- **Multi-Agent Orchestration**: Client-side simulation of agent collaboration—primary agent responds first, followed by observers with streaming feedback.
- **Session Management**: Create, list, switch, and delete sessions using `/api/sessions` endpoints; localStorage for agent configs with optional persistence.
- **Real-Time Streaming**: Live typing indicators and smooth animations for agent responses.
- **Responsive & Polished UI**: Mobile-first design with micro-interactions, hover states, and professional-grade visual hierarchy.
- **Integration with Cloudflare AI**: Leverages Cloudflare Workers for backend persistence, OpenAI-compatible models, and tool support (e.g., web search, weather).
- **Export & Sharing**: UI for exporting conversations (JSON, text, Markdown) with mock functionality in initial phases.

Conclave eliminates setup complexity while delivering the benefits of collaborative AI, like diverse perspectives in natural group conversations.

[cloudflarebutton]

## Technology Stack

- **Frontend**: React 18, Vite (build tool), Tailwind CSS, shadcn/ui (Radix UI primitives), Framer Motion (animations), Lucide React (icons), @tanstack/react-query (data fetching), Zustand (state management), React Router (routing).
- **Backend**: Cloudflare Workers, Durable Objects (ChatAgent, AppController), Hono (routing), OpenAI SDK (AI integration), Model Context Protocol (MCP) for tools.
- **Styling & Utilities**: Tailwind CSS Animate, clsx, tailwind-merge.
- **Additional Libraries**: Sonner (toasts), Recharts (analytics, future phases), @dnd-kit (drag-and-drop, optional).

## Installation

This project uses Bun as the package manager for faster performance. Ensure you have Bun installed (version 1.0+).

1. Clone the repository:
   ```
   git clone <repository-url>
   cd conclave-ai
   ```

2. Install dependencies:
   ```
   bun install
   ```

3. Set up environment variables in `wrangler.jsonc` (or via Wrangler secrets):
   - `CF_AI_BASE_URL`: Your Cloudflare AI Gateway URL (e.g., `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai`).
   - `CF_AI_API_KEY`: Your Cloudflare AI API key.
   - Optional: `SERPAPI_KEY` for web search tools, `OPENROUTER_API_KEY` for alternative models.

4. Generate TypeScript types for Workers:
   ```
   bun run cf-typegen
   ```

## Usage

### Running the Development Server

Start the local development server:
```
bun run dev
```

The app will be available at `http://localhost:3000` (or the port specified by `$PORT`). Hot module replacement is enabled for rapid iteration.

### Basic Interactions

- **Workspace Navigation**: Use the left pane to manage agents (add/edit via drawer) and sessions (new chat, switch, delete).
- **Chat Flow**: Type in the composer and send—watch the primary agent stream a response, followed by observers.
- **Agent Setup**: Click "New Agent" to configure personas; save to localStorage or attach to sessions.
- **Model Selection**: Choose from supported models (e.g., Gemini variants) via dropdown; changes persist per session.
- **Sessions**: Create new chats with auto-generated titles based on first messages; export via modal.

### Example: Starting a Conversation

1. Open the app and create a new session.
2. Configure agents: Set a primary agent as "Facilitator" (professional, detailed) and add observers like "Analyst" and "Creative".
3. Send a message: "Help me brainstorm app ideas for productivity."
4. Observe: Primary responds first, observers add feedback in sequence with live status updates in the right pane.

Note: AI requests are rate-limited across Cloudflare deployments. A notice appears in the footer for user awareness.

## Development

### Project Structure

- `src/`: React frontend (pages, components, hooks, lib).
  - `pages/HomePage.tsx`: Main workspace view (rewrite as needed).
  - `lib/chat.ts`: API service for chat and sessions.
- `worker/`: Cloudflare Workers backend.
  - `agent.ts`: ChatAgent Durable Object for conversation state.
  - `userRoutes.ts`: Custom API routes (extend here for new features).
- `tailwind.config.js`: Extended for custom gradients, animations, and shadows.

### Adding Features

- **New Agents/Tools**: Extend `worker/tools.ts` for custom tools; frontend orchestrates via `chatService`.
- **UI Components**: Import shadcn/ui primitives (e.g., `Sheet` for drawers, `Card` for panels). Ensure responsive grids (Tailwind `grid-cols-1 md:grid-cols-[260px,1fr,340px]`).
- **State Management**: Use Zustand for global state (e.g., agents, sessions); follow primitive selectors to avoid re-render loops.
- **Animations**: Wrap elements in `motion.div` from Framer Motion for entry/exit effects.
- **Testing**: Run `bun run lint` for ESLint checks. Use React Query for caching API calls.

### Common Pitfalls

- Avoid modifying core files like `worker/index.ts` or bindings in `wrangler.jsonc`.
- Ensure streaming handles `reader.releaseLock()` to prevent leaks.
- For multi-agent flows, sequence API calls client-side to simulate collaboration without backend changes.

Contribute by following the phases in the blueprint: Phase 1 (visual foundation), Phase 2 (summaries/export), Phase 3 (analytics/presets).

## Deployment

Deploy to Cloudflare Workers for global edge execution with Durable Objects for state persistence.

1. Install Wrangler CLI:
   ```
   bun add -g wrangler
   wrangler login
   ```

2. Configure secrets:
   ```
   wrangler secret put CF_AI_API_KEY
   wrangler secret put SERPAPI_KEY  # If using search tools
   ```

3. Build and deploy:
   ```
   bun run build
   wrangler deploy
   ```

The app will be live at `<project-name>.workers.dev`. Monitor via Cloudflare dashboard; Durable Objects handle session state automatically.

For one-click deployment:

[cloudflarebutton]

### Production Notes

- Assets are served as a SPA; API routes proxy to Durable Objects.
- Observability is enabled; check Worker logs for errors.
- Scale: Handles concurrent sessions via Cloudflare's edge network.

## Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit changes (`git commit -m 'Add some amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

We welcome contributions aligning with the blueprint phases. Review the `<PHASES GENERATION STRATEGY>` for iterative development focus.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.