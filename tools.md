# Claude Code Tools Reference

This document lists all tools available to Claude Code.

---

## Task

Launch a new agent to handle complex, multi-step tasks autonomously.

**Schema:**
```json
{
  "type": "object",
  "required": ["description", "prompt", "subagent_type"],
  "properties": {
    "description": {
      "type": "string",
      "description": "A short (3-5 word) description of the task"
    },
    "prompt": {
      "type": "string",
      "description": "The task for the agent to perform"
    },
    "subagent_type": {
      "type": "string",
      "description": "The type of specialized agent to use for this task"
    },
    "model": {
      "type": "string",
      "enum": ["sonnet", "opus", "haiku"],
      "description": "Optional model to use for this agent"
    },
    "resume": {
      "type": "string",
      "description": "Optional agent ID to resume from"
    },
    "run_in_background": {
      "type": "boolean",
      "description": "Set to true to run this agent in the background"
    },
    "max_turns": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 9007199254740991,
      "description": "Maximum number of agentic turns before stopping"
    }
  }
}
```

**Available agent types:**
- `Bash` - Command execution specialist for git operations, command execution, terminal tasks
- `general-purpose` - General-purpose agent for researching complex questions, searching code, multi-step tasks
- `statusline-setup` - Configure user's Claude Code status line setting
- `Explore` - Fast agent for exploring codebases (find files, search code, answer codebase questions)
- `Plan` - Software architect agent for designing implementation plans
- `claude-code-guide` - Answer questions about Claude Code, Agent SDK, Claude API

---

## TaskOutput

Retrieves output from a running or completed task (background shell, agent, or remote session).

**Schema:**
```json
{
  "type": "object",
  "required": ["task_id", "block", "timeout"],
  "properties": {
    "task_id": {
      "type": "string",
      "description": "The task ID to get output from"
    },
    "block": {
      "type": "boolean",
      "default": true,
      "description": "Whether to wait for completion"
    },
    "timeout": {
      "type": "number",
      "default": 30000,
      "minimum": 0,
      "maximum": 600000,
      "description": "Max wait time in ms"
    }
  }
}
```

---

## Bash

Executes a given bash command in a persistent shell session with optional timeout.

**Schema:**
```json
{
  "type": "object",
  "required": ["command"],
  "properties": {
    "command": {
      "type": "string",
      "description": "The command to execute"
    },
    "description": {
      "type": "string",
      "description": "Clear, concise description of what this command does"
    },
    "timeout": {
      "type": "number",
      "description": "Optional timeout in milliseconds (max 600000)"
    },
    "run_in_background": {
      "type": "boolean",
      "description": "Set to true to run this command in the background"
    },
    "dangerouslyDisableSandbox": {
      "type": "boolean",
      "description": "Set to true to override sandbox mode"
    }
  }
}
```

---

## Glob

Fast file pattern matching tool that works with any codebase size.

**Schema:**
```json
{
  "type": "object",
  "required": ["pattern"],
  "properties": {
    "pattern": {
      "type": "string",
      "description": "The glob pattern to match files against"
    },
    "path": {
      "type": "string",
      "description": "The directory to search in. Defaults to current working directory."
    }
  }
}
```

---

## Grep

A powerful search tool built on ripgrep.

**Schema:**
```json
{
  "type": "object",
  "required": ["pattern"],
  "properties": {
    "pattern": {
      "type": "string",
      "description": "The regular expression pattern to search for"
    },
    "path": {
      "type": "string",
      "description": "File or directory to search in. Defaults to current working directory."
    },
    "glob": {
      "type": "string",
      "description": "Glob pattern to filter files (e.g. \"*.js\", \"*.{ts,tsx}\")"
    },
    "type": {
      "type": "string",
      "description": "File type to search (e.g. js, py, rust, go, java)"
    },
    "output_mode": {
      "type": "string",
      "enum": ["content", "files_with_matches", "count"],
      "description": "Output mode. Defaults to 'files_with_matches'."
    },
    "-A": {
      "type": "number",
      "description": "Number of lines to show after each match"
    },
    "-B": {
      "type": "number",
      "description": "Number of lines to show before each match"
    },
    "-C": {
      "type": "number",
      "description": "Number of lines to show before and after each match"
    },
    "-i": {
      "type": "boolean",
      "description": "Case insensitive search"
    },
    "-n": {
      "type": "boolean",
      "description": "Show line numbers in output. Defaults to true."
    },
    "multiline": {
      "type": "boolean",
      "description": "Enable multiline mode where . matches newlines. Default: false."
    },
    "head_limit": {
      "type": "number",
      "description": "Limit output to first N lines/entries. Defaults to 0 (unlimited)."
    },
    "offset": {
      "type": "number",
      "description": "Skip first N lines/entries. Defaults to 0."
    }
  }
}
```

---

## Read

Reads a file from the local filesystem.

**Schema:**
```json
{
  "type": "object",
  "required": ["file_path"],
  "properties": {
    "file_path": {
      "type": "string",
      "description": "The absolute path to the file to read"
    },
    "offset": {
      "type": "number",
      "description": "The line number to start reading from"
    },
    "limit": {
      "type": "number",
      "description": "The number of lines to read"
    }
  }
}
```

**Notes:**
- Reads up to 2000 lines by default
- Lines longer than 2000 characters are truncated
- Can read images (PNG, JPG), PDFs, and Jupyter notebooks (.ipynb)

---

## Edit

Performs exact string replacements in files.

**Schema:**
```json
{
  "type": "object",
  "required": ["file_path", "old_string", "new_string"],
  "properties": {
    "file_path": {
      "type": "string",
      "description": "The absolute path to the file to modify"
    },
    "old_string": {
      "type": "string",
      "description": "The text to replace"
    },
    "new_string": {
      "type": "string",
      "description": "The text to replace it with (must be different from old_string)"
    },
    "replace_all": {
      "type": "boolean",
      "default": false,
      "description": "Replace all occurrences of old_string"
    }
  }
}
```

---

## Write

Writes a file to the local filesystem.

**Schema:**
```json
{
  "type": "object",
  "required": ["file_path", "content"],
  "properties": {
    "file_path": {
      "type": "string",
      "description": "The absolute path to the file to write (must be absolute)"
    },
    "content": {
      "type": "string",
      "description": "The content to write to the file"
    }
  }
}
```

---

## NotebookEdit

Replaces the contents of a specific cell in a Jupyter notebook.

**Schema:**
```json
{
  "type": "object",
  "required": ["notebook_path", "new_source"],
  "properties": {
    "notebook_path": {
      "type": "string",
      "description": "The absolute path to the Jupyter notebook file"
    },
    "new_source": {
      "type": "string",
      "description": "The new source for the cell"
    },
    "cell_id": {
      "type": "string",
      "description": "The ID of the cell to edit"
    },
    "cell_type": {
      "type": "string",
      "enum": ["code", "markdown"],
      "description": "The type of the cell"
    },
    "edit_mode": {
      "type": "string",
      "enum": ["replace", "insert", "delete"],
      "description": "The type of edit to make. Defaults to replace."
    }
  }
}
```

---

## WebFetch

Fetches content from a URL and processes it using an AI model.

**Schema:**
```json
{
  "type": "object",
  "required": ["url", "prompt"],
  "properties": {
    "url": {
      "type": "string",
      "format": "uri",
      "description": "The URL to fetch content from"
    },
    "prompt": {
      "type": "string",
      "description": "The prompt to run on the fetched content"
    }
  }
}
```

---

## WebSearch

Search the web and use results to inform responses.

**Schema:**
```json
{
  "type": "object",
  "required": ["query"],
  "properties": {
    "query": {
      "type": "string",
      "minLength": 2,
      "description": "The search query to use"
    },
    "allowed_domains": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Only include search results from these domains"
    },
    "blocked_domains": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Never include search results from these domains"
    }
  }
}
```

---

## TodoWrite

Create and manage a structured task list for the current coding session.

**Schema:**
```json
{
  "type": "object",
  "required": ["todos"],
  "properties": {
    "todos": {
      "type": "array",
      "description": "The updated todo list",
      "items": {
        "type": "object",
        "required": ["content", "status", "activeForm"],
        "properties": {
          "content": {
            "type": "string",
            "minLength": 1,
            "description": "The imperative form (e.g., 'Run tests')"
          },
          "status": {
            "type": "string",
            "enum": ["pending", "in_progress", "completed"]
          },
          "activeForm": {
            "type": "string",
            "minLength": 1,
            "description": "The present continuous form (e.g., 'Running tests')"
          }
        }
      }
    }
  }
}
```

---

## AskUserQuestion

Ask the user questions during execution.

**Schema:**
```json
{
  "type": "object",
  "required": ["questions"],
  "properties": {
    "questions": {
      "type": "array",
      "minItems": 1,
      "maxItems": 4,
      "description": "Questions to ask the user (1-4 questions)",
      "items": {
        "type": "object",
        "required": ["question", "header", "options", "multiSelect"],
        "properties": {
          "question": {
            "type": "string",
            "description": "The complete question to ask"
          },
          "header": {
            "type": "string",
            "description": "Very short label (max 12 chars)"
          },
          "options": {
            "type": "array",
            "minItems": 2,
            "maxItems": 4,
            "items": {
              "type": "object",
              "required": ["label", "description"],
              "properties": {
                "label": {
                  "type": "string",
                  "description": "Display text (1-5 words)"
                },
                "description": {
                  "type": "string",
                  "description": "Explanation of this option"
                }
              }
            }
          },
          "multiSelect": {
            "type": "boolean",
            "default": false,
            "description": "Allow multiple selections"
          }
        }
      }
    },
    "answers": {
      "type": "object",
      "description": "User answers collected by the permission component"
    },
    "metadata": {
      "type": "object",
      "properties": {
        "source": {
          "type": "string",
          "description": "Optional identifier for analytics"
        }
      }
    }
  }
}
```

---

## KillShell

Kills a running background bash shell by its ID.

**Schema:**
```json
{
  "type": "object",
  "required": ["shell_id"],
  "properties": {
    "shell_id": {
      "type": "string",
      "description": "The ID of the background shell to kill"
    }
  }
}
```

---

## Skill

Execute a skill within the main conversation.

**Schema:**
```json
{
  "type": "object",
  "required": ["skill"],
  "properties": {
    "skill": {
      "type": "string",
      "description": "The skill name (e.g., 'commit', 'review-pr', 'pdf')"
    },
    "args": {
      "type": "string",
      "description": "Optional arguments for the skill"
    }
  }
}
```

---

## EnterPlanMode

Transitions into plan mode to explore the codebase and design an implementation approach for user approval.

**Schema:**
```json
{
  "type": "object",
  "properties": {}
}
```

---

## ExitPlanMode

Signal completion of planning phase and request user approval.

**Schema:**
```json
{
  "type": "object",
  "properties": {
    "allowedPrompts": {
      "type": "array",
      "description": "Prompt-based permissions needed to implement the plan",
      "items": {
        "type": "object",
        "required": ["tool", "prompt"],
        "properties": {
          "tool": {
            "type": "string",
            "enum": ["Bash"],
            "description": "The tool this prompt applies to"
          },
          "prompt": {
            "type": "string",
            "description": "Semantic description of the action (e.g., 'run tests')"
          }
        }
      }
    }
  }
}
```
