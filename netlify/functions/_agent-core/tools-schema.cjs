/**
 * Tools Schema Module
 *
 * Tool definitions for Claude API tool use in agent chat.
 * Defines the available tools and their input schemas.
 */

/**
 * Base action management tools (always available)
 */
const actionTools = [
  {
    name: "get_action_details",
    description: "Retrieve the full details of a specific action, including complete content for manual actions and full taskConfig for scheduled actions. Use when the user wants to work on, discuss, or modify a specific action.",
    input_schema: {
      type: "object",
      properties: {
        action_id: {
          type: "string",
          description: "The action ID (format: action-{timestamp}-{random})"
        }
      },
      required: ["action_id"]
    }
  },
  {
    name: "update_action",
    description: "Update an existing action's metadata. Can modify title, description, priority, or taskConfig fields (instructions, expectedOutput). Cannot change state (use complete_action instead) or taskType.",
    input_schema: {
      type: "object",
      properties: {
        action_id: {
          type: "string",
          description: "The action ID to update"
        },
        updates: {
          type: "object",
          description: "Fields to update",
          properties: {
            title: { type: "string", description: "New title for the action" },
            description: { type: "string", description: "New description" },
            priority: { type: "string", enum: ["low", "medium", "high"], description: "Priority level" },
            taskConfig: {
              type: "object",
              description: "Task configuration updates",
              properties: {
                instructions: { type: "string", description: "Updated execution instructions" },
                expectedOutput: { type: "string", description: "Updated expected output description" }
              }
            }
          }
        }
      },
      required: ["action_id", "updates"]
    }
  },
  {
    name: "complete_action",
    description: "Mark an action as complete. Use when the user asks to complete, finish, or mark done an action. Cannot complete actions that are already completed or dismissed.",
    input_schema: {
      type: "object",
      properties: {
        action_id: {
          type: "string",
          description: "The action ID to complete (format: action-{timestamp}-{random})"
        }
      },
      required: ["action_id"]
    }
  }
];

/**
 * Note capture tools
 */
const noteTools = [
  {
    name: "create_note",
    description: "Save a note, link, or idea for later reference. Use this for quick captures during conversation.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Note type (e.g., url, idea, bookmark, reference)" },
        title: { type: "string", description: "Brief title" },
        content: { type: "string", description: "Note content or description" },
        metadata: {
          type: "object",
          description: "Optional metadata",
          properties: {
            url: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            source: { type: "string" }
          }
        }
      },
      required: ["type", "title", "content"]
    }
  },
  {
    name: "get_notes",
    description: "Retrieve saved notes for this agent. Use to review captures or find information to reference.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["active", "archived", "merged"], description: "Filter by status (default: active)" },
        type: { type: "string", description: "Filter by note type" },
        limit: { type: "number", description: "Max notes to return (default: 20)" }
      }
    }
  },
  {
    name: "update_note",
    description: "Update an existing note's content or metadata.",
    input_schema: {
      type: "object",
      properties: {
        note_id: { type: "string", description: "The note ID to update" },
        updates: {
          type: "object",
          description: "Fields to update",
          properties: {
            title: { type: "string" },
            content: { type: "string" },
            type: { type: "string" },
            status: { type: "string", enum: ["active", "archived", "merged"] },
            metadata: { type: "object" }
          }
        }
      },
      required: ["note_id", "updates"]
    }
  }
];

/**
 * Filesystem tools (only available in local mode with filesystem capability)
 */
const filesystemTools = [
  {
    name: "read_file",
    description: "Read a file from this agent's local data directory.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path within agent's data directory" }
      },
      required: ["path"]
    }
  },
  {
    name: "write_file",
    description: "Write content to a file in this agent's local data directory. Creates directories as needed.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path within agent's data directory" },
        content: { type: "string", description: "File content to write" },
        mode: { type: "string", enum: ["overwrite", "append"], description: "Write mode (default: overwrite)" }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "list_files",
    description: "List files in this agent's local data directory.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative subdirectory path (default: root)" }
      }
    }
  }
];

/**
 * Review tools (only available during draft review sessions)
 */
const reviewTools = [
  {
    name: "get_pending_drafts",
    description: "Retrieve pending content drafts for this agent that need user review",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Filter by draft type (e.g., 'company')" }
      }
    }
  },
  {
    name: "submit_draft_review",
    description: "Submit the user's review feedback for a specific content draft. Extract real values from the conversation - do not use placeholders or generic text.",
    input_schema: {
      type: "object",
      properties: {
        draftId: { type: "string", description: "The draft ID being reviewed" },
        score: { type: "number", description: "User's fit score 0-10 based on their expressed interest (8-10: excited, 5-7: interested with reservations, 1-4: not interested, 0: rejected)" },
        feedback: { type: "string", description: "1-2 sentence summary of the user's actual opinion in their own words. NEVER leave empty." },
        user_tags: { type: "array", items: { type: "string" }, description: "Tags the user mentioned or that describe their sentiment" }
      },
      required: ["draftId", "score", "feedback"]
    }
  }
];

/**
 * Build tools array based on context
 * @param {Object} options - Build options
 * @param {boolean} [options.includeFilesystem] - Include filesystem tools
 * @param {boolean} [options.includeReview] - Include review tools
 * @returns {Array} Array of tool definitions
 */
function buildTools(options = {}) {
  const { includeFilesystem = false, includeReview = false } = options;

  const tools = [...actionTools, ...noteTools];

  if (includeFilesystem) {
    tools.push(...filesystemTools);
  }

  if (includeReview) {
    tools.push(...reviewTools);
  }

  return tools;
}

module.exports = {
  actionTools,
  noteTools,
  filesystemTools,
  reviewTools,
  buildTools
};
