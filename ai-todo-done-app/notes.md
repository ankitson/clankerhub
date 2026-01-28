# AI TO-DONE App Development Notes

## Project Overview
Building a prototype of an AI-powered todo app where an AI agent automatically starts working on tasks as they're added.

## Key Features Needed
1. AI automatically breaks down tasks into subtasks
2. AI can execute tasks if it has capabilities
3. User can step in and course correct
4. Plugin system for skills/context info
5. Research phase + user interview (like Claude Code plan mode)
6. Progress tracking with clear metrics

## Research Phase

### Existing Todo Apps to Research
- Looking for core primitives: scheduling, recurrences, tasks, habits, time tracking

## Development Log

### Session 1 - Initial Setup
- Created project folder
- Starting research on existing todo app implementations

### Research Findings

#### Reference Apps Studied:
1. **Super Productivity** - Advanced todo with time tracking, Jira/GitHub integration
2. **Vikunja** - Self-hosted with hierarchical projects, Gantt/Kanban views
3. **Tududi** - Recurring tasks, Telegram integration, area categorization

#### Key Primitives from Super Productivity's Data Model:

**Task Model Fields:**
- Core: id, projectId, title, isDone, subTaskIds, created
- Time Tracking: timeSpentOnDay, timeSpent, timeEstimate
- Scheduling: dueWithTime, dueDay, remindAt, hasPlannedTime
- Organization: tagIds, attachments, parentId
- Metadata: modified, doneOn

**Repeat Config Fields:**
- repeatCycle: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
- repeatEvery: number
- Day selectors: monday, tuesday, etc.
- shouldInheritSubtasks, subTaskTemplates

**Project Model:**
- title, isArchived, taskIds, backlogTaskIds
- Configuration forms, theme settings

### Design Decisions for AI TO-DONE App

1. **Task States**: Not just done/not-done, but a full lifecycle:
   - `pending` - Just added
   - `researching` - AI is gathering information
   - `planning` - AI is breaking down into subtasks
   - `awaiting_input` - Needs user clarification
   - `in_progress` - Being actively worked on
   - `blocked` - Waiting on something
   - `completed` - Done!

2. **Progress Metrics**: Each goal can have:
   - Subtask completion percentage
   - Custom measurable (e.g., "miles run", "documents gathered")
   - Time invested

3. **Skill System**: Directory of capabilities the AI can use:
   - File operations
   - Web research
   - Calendar management
   - External API integrations

4. **Interview System**: Like Claude Code's plan mode:
   - AI proposes approach
   - User can modify/approve
   - AI executes with checkpoints

### Implementation Phase

#### Files Created:

**Types (`src/types/`)**
- `task.ts` - Core Task, Subtask, ProgressMetric, AIPlan interfaces
- `skill.ts` - Skill system with SkillRegistry for plugin management
- `agent.ts` - Agent configuration, modes, and message types

**Agent (`src/agent/`)**
- `agent.ts` - Main ToDoneAgent class orchestrating the workflow
- `mock-ai.ts` - Mock AI provider with task templates for demo

**Skills (`src/skills/`)**
- `builtin-skills.ts` - Default skills: file search, research, calendar, notes, reminders
- `skill-loader.ts` - Load custom skill directories from manifest.json

**Store (`src/store/`)**
- `task-store.ts` - In-memory + file persistence for tasks

**CLI (`src/cli/`)**
- `cli.ts` - Interactive command-line interface

**Demo**
- `demo.ts` - Non-interactive demonstration script

#### Key Design Patterns:

1. **Event-driven Architecture**: Agent emits messages that handlers can subscribe to
2. **Immutable Updates**: Task modifications return new objects
3. **Plugin System**: Skills loaded from directories with manifest.json
4. **Template-based Mock AI**: Recognizes common tasks and provides pre-built plans

#### What Works:
- Adding tasks triggers AI analysis
- AI generates plans with subtasks and metrics
- Clarification questions for user input
- Plan approval/modification workflow
- Subtask completion tracking
- Progress metrics with history
- File-based persistence
- Interactive CLI with colored output

#### What's Mock/Simplified:
- AI responses are template-based (real LLM integration needed)
- Skills don't actually execute (stubs that return success)
- No actual web research or file operations
- Single-user, local only

### Lessons Learned

1. Task lifecycle is more complex than simple done/not-done
2. Progress metrics need to be task-specific (miles for running, docs for taxes)
3. The "interview" phase (clarification questions) is crucial for good plans
4. Skill system needs clear input/output schemas for AI to use them
5. Event-driven updates work well for agent → UI communication
