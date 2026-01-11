# HabitualOS

**A personal agentic AI orchestration platform for accomplishing almost anything**

HabitualOS is an intelligent agent system that helps you make consistent progress toward your dreams by breaking them into actionable steps, executing tasks autonomously, and delivering real work product to where it matters most.

---

## 🎯 What is HabitualOS?

Unlike traditional AI chat interfaces that are ephemeral and conversational, HabitualOS:

- **Maintains persistent context** about your goals and progress
- **Generates prioritized action steps** that move you forward
- **Executes tasks autonomously** through AI agents
- **Delivers artifacts** directly to GitHub, Substack, your filesystem, and more
- **Celebrates tangible progress** through accumulated work, not arbitrary points
- **Enforces rest cycles** to prevent burnout and maintain sustainable productivity

Think of it as your **personal AI project manager** that actually does the work, not just talks about it.

---

## 💡 Why HabitualOS?

### The Problem

When working with AI tools today, you face:
- **Context fragmentation** - conversations are siloed and ephemeral
- **Action paralysis** - too many possibilities, unclear next steps
- **Lost momentum** - no system to track what you've built or where you're going
- **Copy-paste hell** - constantly moving AI outputs to where they're actually useful
- **Burnout cycles** - grinding without intentional rest

### The Solution

HabitualOS is an **orchestration layer** that:
- Keeps you focused on ONE north star goal at a time
- Suggests 3-5 highest-priority actions you can take right now
- Lets you refine via chat, then executes and delivers for you
- Builds a portfolio of accumulated artifacts (writing, code, research)
- Encourages rest by saying "great work, come back tomorrow" when actions complete

---

## 🚀 Use Cases

### For Job Seekers
**North Star:** "Get a dream job in AI/ML engineering by Q2 2025"

**HabitualOS helps you:**
- Generate portfolio blog posts about your learning journey
- Create visual documentation of projects you've built
- Research target companies and draft personalized outreach
- Build demo projects with code delivered directly to GitHub
- Track momentum: "15 blog posts written, 8 projects completed, 12 companies contacted"

### For Founders & Builders
**North Star:** "Launch MVP of my SaaS product and get 100 beta users"

**HabitualOS helps you:**
- Generate feature specs and user stories
- Write code (via Claude Code integration) and commit to your repo
- Draft marketing copy for landing pages
- Create social media content and publish to LinkedIn
- Research competitors and synthesize findings

### For Writers & Creators
**North Star:** "Publish 50 essays and build an audience of 1,000 subscribers"

**HabitualOS helps you:**
- Generate article outlines based on your interests
- Draft full posts and deliver directly to Substack
- Create supporting visuals and diagrams
- Research trending topics in your niche
- Track output: "32 articles published, 847 subscribers gained"

### For Researchers & Students
**North Star:** "Complete my thesis on AI safety by December 2025"

**HabitualOS helps you:**
- Break research into manageable chunks
- Generate literature review summaries
- Draft methodology and analysis sections
- Create visualizations of findings
- Organize notes and references in Notion/Obsidian

---

## 🏗️ How It Works

### 1. Define Your North Star
Chat with the agent to articulate your overarching goal. The system helps you structure it using SMART criteria (Specific, Measurable, Achievable, Relevant, Time-bound).

### 2. Get Action Cards
The agent immediately generates 3-5 highest-priority actions you can take right now. No dependencies, no overwhelm—just clear next steps.

### 3. Refine Via Chat
Click an action card to open a persistent chat thread. Refine the task, ask questions, iterate on the approach. All context is saved.

### 4. Agent Executes & Delivers
When you're satisfied, the agent generates the artifact (code, writing, research) and delivers it via MCP integrations:
- Code → GitHub
- Articles → Substack
- Posts → LinkedIn
- Files → Local filesystem
- Notes → Notion/Obsidian

### 5. Celebrate Progress
See your accumulated work: "15 documents created, 8 code commits, 3 research reports." Real progress, not gamified points.

### 6. Rest & Return
When all actions complete, the agent congratulates you and suggests coming back tomorrow. Sustainable productivity built into the system.

---

## 🛠️ Tech Stack

- **Frontend:** 11ty (static site generator) + Nunjucks templating
- **Backend:** Serverless functions (Netlify)
- **Database:** Firestore (Firebase NoSQL database)
- **AI:** Claude API (Anthropic) - configurable and swappable
- **Memory:** mem0 integration for cross-session learning
- **Integrations:** MCP servers for GitHub, filesystem, Substack, LinkedIn, etc.

**Design Philosophy:**
- Local-first (you control your data)
- Configuration-driven (no hardcoded API keys)
- Modular & extensible (swap components easily)
- Mobile-friendly (works on phone, tablet, desktop)

---

## 📦 Installation & Setup

> **Note:** HabitualOS is in active development. Installation instructions will be updated as the project evolves.

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Anthropic API key (sign up at https://console.anthropic.com)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/habitualos.git
cd habitualos

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your API keys

# Run database migrations
npm run db:migrate

# Start development server
npm run dev

# Open in browser
open http://localhost:8080
```

### Configuration

Create a `.env` file in the project root:

```env
ANTHROPIC_API_KEY=your_api_key_here
MEM0_API_KEY=your_mem0_key_here
DATABASE_URL=your_database_url_here

# Optional: MCP server configurations
GITHUB_TOKEN=your_github_token
SUBSTACK_API_KEY=your_substack_key
```

### Deployment

HabitualOS can be deployed to:
- **Netlify** (recommended for MVP)
- **Vercel**
- **Cloudflare Pages**
- **Self-hosted** on any VPS (DigitalOcean, Fly.io, Railway)

Detailed deployment guides coming soon.

---

## 📚 Documentation

- **[Architecture Guide](./ARCHITECTURE.md)** - Deep dive into system design, data models, and workflows
- **API Documentation** - Coming soon
- **MCP Integration Guide** - Coming soon
- **Deployment Guide** - Coming soon

---

## 🎨 Dogfooding

**HabitualOS is building itself.**

The first North Star: "Build HabitualOS MVP ready for demo and job search"

Every feature, every line of code, every decision documented—all tracked as action cards in the system. This validates the concept while building it, surfaces UX issues early, and creates a compelling demo story.

---

## 🗺️ Roadmap

### MVP (Current Focus)
- ✅ Architecture definition
- ⏳ Core data models (NorthStar, ActionCard, ChatContext)
- ⏳ Agent orchestration loop
- ⏳ Basic UI (NorthStar creation, action cards, chat)
- ⏳ Claude API integration
- ⏳ First MCP integration (filesystem or GitHub)
- ⏳ Progress metrics visualization

### Phase 2
- mem0 integration for personalized learning
- Multiple MCP destinations (Substack, LinkedIn, Notion)
- Scheduled check-ins for action generation
- Rich markdown preview
- Mobile-optimized UI

### Phase 3
- Multi-model routing (cost optimization)
- Bi-directional artifact sync
- Claude Code direct integration
- Community MCP marketplace
- Advanced analytics

### Future
- Multi-user support with auth
- Team collaboration features
- Self-hosting packages (Docker Compose)
- Desktop and mobile native apps

---

## 🤝 Contributing

HabitualOS is open source and welcomes contributions!

**Ways to contribute:**
- Report bugs and suggest features via GitHub Issues
- Submit pull requests for bug fixes or new features
- Build MCP integrations for new destinations
- Improve documentation
- Share your use cases and success stories

**Development workflow:**
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly
5. Commit with clear messages (`git commit -m 'Add amazing feature'`)
6. Push to your fork (`git push origin feature/amazing-feature`)
7. Open a Pull Request

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines (coming soon).

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details

This means you're free to:
- Use HabitualOS for personal or commercial projects
- Modify and distribute the code
- Build derivative works
- Self-host your own instance

Just keep the license notice and don't hold us liable.

---

## 🙏 Acknowledgments

- **Anthropic** for Claude and the vision of beneficial AI
- **MCP community** for extensible integrations
- **mem0** for intelligent memory systems
- Everyone building in the AI orchestration space

---

## 💬 Community & Support

- **GitHub Issues:** Bug reports and feature requests
- **Discussions:** Share use cases, ask questions, connect with other users
- **Twitter/X:** Follow [@habitualos](https://twitter.com/habitualos) for updates (coming soon)

---

## 🌟 Star History

If HabitualOS helps you achieve your goals, consider giving it a star ⭐ on GitHub!

---

**Built with ❤️ by creators who believe in sustainable productivity and AI that amplifies human potential.**

---

*Last updated: December 7, 2025*
