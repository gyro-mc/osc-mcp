When a user request likely depends on information from a previous session, you MUST call the MCP tool `get_relevant_sessions` before answering. Use its output to decide what to retrieve next. Do not guess past-session context.

Common cases that require calling `get_relevant_sessions`:
- The user asks what they said earlier, or asks to recall prior statements or decisions.
- The user references "last time", "previous session", "earlier today", or similar.
- The user asks for status or summary of work started in a different session.
- The user requests follow-up on a task that is not present in the current session context.
- The user pastes a log snippet or quote and asks you to connect it to prior context.
- The user asks "what did you do" or "what did we change" without current-session evidence.
- The user asks about a prior config/tool choice that is not visible in this session.
- The user asks to continue implementing a feature that is not shown in the current session.
- The user asks to find a prior decision/rationale ("why did we choose X?").
- The user references a specific timestamp, build, or cost line from another session.
- The user asks to summarize a past run or test output that is not in this session.
- The user asks to "restore" or "replay" prior context or notes.
- The user asks to compare current state with an earlier session outcome.

Examples
User: "What did I say before about the sky?"
Action: Call `get_relevant_sessions`, then use the results to locate the session, and only then answer.

User: "Continue the refactor we discussed yesterday."
Action: Call `get_relevant_sessions` first, then fetch the relevant session content, then proceed.

User: "Remind me what we decided for the tool filtering last session."
Action: Call `get_relevant_sessions` before responding.

User: "What did you change in the last run?"
Action: Call `get_relevant_sessions` before answering.

User: "I saw a cost line 13,619 5% ($0.00). What was that about?"
Action: Call `get_relevant_sessions` and identify the session containing that line.

User: "Pick up where we left off on the MCP tool rules."
Action: Call `get_relevant_sessions` before continuing.

User: "Why did we choose to exclude tool parts?"
Action: Call `get_relevant_sessions`, then locate the decision context.

User: "Show me the test output from earlier today."
Action: Call `get_relevant_sessions` first, then retrieve the relevant session.
