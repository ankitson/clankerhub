# TO-DONE: AI-Powered Task Manager

An AI-powered "TO-DONE" app prototype where an AI agent automatically starts working on tasks as you add them. Instead of a passive todo list, this is an active assistant that researches, plans, and helps execute your goals.

## Key Concepts

### The TO-DONE Philosophy

Traditional todo apps are passive - you add items and check them off. TO-DONE is different:

1. **You add a task** → "Do my taxes"
2. **AI researches** → Gathers context about tax preparation
3. **AI plans** → Breaks down into subtasks, suggests metrics
4. **AI asks questions** → Clarifies your specific situation
5. **You approve/modify** → Course correct the plan
6. **AI + You execute** → Some tasks automated, some manual

### Core Features

- **Automatic Task Decomposition**: AI breaks down goals into actionable subtasks
- **Research Phase**: AI gathers relevant information before planning
- **User Interview**: Clarification questions ensure the plan fits your needs
- **Progress Metrics**: Measurable indicators for each goal (e.g., "miles run" for fitness goals)
- **Skill Plugins**: Extensible automation capabilities
- **Human-in-the-loop**: User can always intervene and course correct

## Installation

```bash
cd ai-todo-done-app
npm install
```

## Usage

### Interactive CLI

```bash
npm start
```

Commands:
- `add <task>` - Add a new task (AI will analyze and plan)
- `list` - List all tasks
- `show` - Show current task details
- `select <n>` - Select a task to work on
- `approve` - Approve the AI's proposed plan
- `complete <n>` - Mark a subtask as complete
- `answer <n> <answer>` - Answer a clarification question
- `progress` - Show progress analysis
- `metric <n> <value>` - Update a progress metric
- `skills` - List available AI skills
- `help` - Show help

### Demo Mode

```bash
npm run demo
```

This runs a non-interactive demonstration showing:
- Adding a "Do my taxes" task
- AI generating a tax preparation plan
- Approving the plan and completing subtasks
- Adding a "Run a 5K" task
- AI creating an 8-week training plan
- Tracking progress with metrics

## Architecture

```
src/
├── types/          # Core data models
│   ├── task.ts     # Task, Subtask, Progress types
│   ├── skill.ts    # Skill system for automation
│   └── agent.ts    # Agent types and interfaces
├── agent/          # AI agent implementation
│   ├── agent.ts    # Main ToDoneAgent class
│   └── mock-ai.ts  # Mock AI provider (templates)
├── skills/         # Plugin system
│   ├── builtin-skills.ts  # Default skills
│   └── skill-loader.ts    # Load custom skill directories
├── store/          # Data persistence
│   └── task-store.ts
└── cli/            # Interactive interface
    └── cli.ts
```

## Data Models

### Task

```typescript
interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;  // pending → researching → planning → awaiting_input → in_progress → completed

  // AI workflow
  researchFindings: ResearchFinding[];
  clarificationQuestions: ClarificationQuestion[];
  aiPlan?: AIPlan;

  // Progress tracking
  subtasks: Subtask[];
  progressMetrics: ProgressMetric[];

  // Time tracking
  timeEstimate?: number;
  timeSpent: number;
}
```

### Progress Metrics

Each task can have measurable progress indicators:

```typescript
interface ProgressMetric {
  name: string;           // "Miles Run", "Documents Gathered"
  unit: string;           // "miles", "documents"
  currentValue: number;
  targetValue: number;
  history: Array<{ timestamp: number; value: number; note?: string }>;
}
```

### Skills (Plugins)

Skills are capabilities the AI can use:

```typescript
interface Skill {
  id: string;
  name: string;
  description: string;
  category: 'research' | 'file_ops' | 'calendar' | 'communication' | 'automation';
  execute: (input: Record<string, unknown>, context: SkillContext) => Promise<SkillResult>;
}
```

Built-in skills:
- `file_search` - Search for files
- `research` - Web research
- `calendar` - Calendar management
- `notes` - Note taking
- `reminder` - Set reminders

## Extending with Custom Skills

Create a skill directory with a `manifest.json`:

```json
{
  "id": "my-skills",
  "name": "My Custom Skills",
  "skills": [
    { "file": "email-skill.js", "id": "email" }
  ],
  "context": [
    {
      "file": "preferences.md",
      "name": "User Preferences",
      "description": "Personal constraints and preferences"
    }
  ]
}
```

## Example Task Flows

### Tax Preparation

1. User adds: "Do my taxes"
2. AI researches tax preparation requirements
3. AI proposes plan:
   - Gather W-2 documents (🤖 automatable)
   - Gather 1099 forms (🤖 automatable)
   - Compile deductions (👤 manual)
   - Choose filing method (👤 manual)
   - Complete return (👤 manual)
4. AI asks: "Self-employment income? Major life changes? Investments?"
5. User approves with modifications
6. Progress tracked: Documents gathered, Forms completed

### Fitness Goal

1. User adds: "Run a 5K"
2. AI researches 5K training plans
3. AI proposes 8-week training plan with:
   - Weekly training phases
   - Progress metrics: Longest run, Training runs completed, Weekly mileage
4. AI asks: "Current fitness level? Target race date? Injuries?"
5. User tracks progress with metric updates

## Future Enhancements

This is a prototype. Future versions could include:

- **Real LLM Integration**: Replace mock AI with actual Claude/GPT API calls
- **Calendar Integration**: Actually create calendar events
- **File System Skills**: Real file searching and organization
- **Web Interface**: React/Vue frontend
- **Collaboration**: Shared tasks and goals
- **Notifications**: Push notifications for reminders and updates
- **Learning**: AI improves based on user feedback

## Development

```bash
# Type check
npm run typecheck

# Run in development mode
npm run dev

# Build for distribution
npm run build
```

## Research References

This prototype was informed by studying existing todo app implementations:

- **Super Productivity** - Task model with time tracking, subtasks, recurrence
- **Vikunja** - Hierarchical projects with multiple views
- **Tududi** - Recurring tasks and area categorization

Key primitives borrowed:
- Task status lifecycle
- Subtask hierarchies
- Recurrence configuration
- Progress metrics and time tracking

## License

MIT
