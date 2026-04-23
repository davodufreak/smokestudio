---
name: scoutqa-test
description: 'This skill should be used when the user asks to "test this website", "run exploratory testing", "check for accessibility issues", "verify the login flow works", "find bugs on this page", or requests automated QA testing. Triggers on web application testing scenarios including smoke tests, accessibility audits, e-commerce flows, and user flow validation using ScoutQA CLI. Use this skill proactively after implementing web application features to verify they work correctly.'
---

# ScoutQA Testing Skill

Perform AI-powered exploratory testing on web applications using the `scoutqa` CLI.

**Think of ScoutQA as an intelligent testing partner** that can autonomously explore, discover issues, and verify features. Delegate testing to multiple parallel ScoutQA executions to maximize coverage while saving time.

## When to Use This Skill

Use this skill in two scenarios:

1. **User requests testing** - When the user explicitly asks to test a website or verify functionality
2. **Proactive verification** - After implementing web features, automatically run tests to verify the implementation works correctly

**Example proactive usage:**

- After implementing a login form → Test the authentication flow
- After adding form validation → Verify validation rules and error handling
- After building a checkout flow → Test the end-to-end purchase process
- After fixing a bug → Verify the fix works and didn't break other features

**Best practice**: When you finish implementing a web feature, proactively start a ScoutQA test in the background to verify it works while you continue with other tasks.

## Running Tests

### Testing Workflow

Copy this checklist and track your progress:

Testing Progress:

- [ ] Write specific test prompt with clear expectations
- [ ] Run scoutqa command in background
- [ ] Inform user of execution ID and browser URL
- [ ] Extract and analyze results

**Step 1: Write specific test prompt**

See "Writing Effective Prompts" section below for guidelines.

**Step 2: Run scoutqa command**

**IMPORTANT**: Use the Bash tool's timeout parameter (5000ms = 5 seconds) to capture execution details:

When calling the Bash tool, set `timeout: 5000` as a parameter:

- This is the Bash tool's built-in timeout parameter in Claude Code (NOT the Unix `timeout` command)
- After 5 seconds, the Bash tool returns control with a task ID and the process continues running in the background
- This is different from Unix `timeout` which kills the process - here the process keeps running
- The first 5 seconds capture the execution ID and browser URL from ScoutQA's output
- The test continues running remotely on ScoutQA's infrastructure with the background task

```bash
scoutqa --url "https://example.com" --prompt "Your test instructions"
```

In the first few seconds, the command will output:

- **Execution ID** (e.g., `019b831d-xxx`)
- **Browser URL** (e.g., `https://app.scoutqa.ai/t/019b831d-xxx`)
- Initial tool calls showing test progress

After the 5-second timeout, the Bash tool returns a task ID and the command continues running in the background. You can work on other tasks while the test runs. The timeout is only to capture the initial output (execution ID and browser URL) - the test keeps running both locally as a background task and remotely on ScoutQA's infrastructure.

**Step 3: Inform user of execution ID and browser URL**

After the Bash tool returns with the task ID (having captured the execution details in the first 5 seconds), inform the user of:

- The ScoutQA execution ID and browser URL so they can monitor progress in their browser
- The background task ID if they want to check local command output later

The test continues running in the background while you continue other work.

**Step 4: Extract and analyze results**

See "Presenting Results" section below for the complete format.

### Command Options

- `--url` (required): Website URL to test (supports `localhost` / `127.0.0.1`)
- `--prompt` (required): Natural language testing instructions
- `--project-id` (optional): Associate with a project for tracking
- `-v, --verbose` (optional): Show all tool calls including internal ones

### Local Testing Support

ScoutQA supports testing `localhost` and `127.0.0.1` URLs autonomously — no manual setup required.

```bash
# Seamlessly test a locally running app when you're developing your app
scoutqa --url "http://localhost:3000" --prompt "Test the registration form"
```

### When to Use Each Command

**Starting a new test?** → Use `scoutqa --url --prompt`
**Verifying a known issue?** → Use `scoutqa issue-verify --issue-id <id>`
**Finding issue IDs from an execution?** → Use `scoutqa list-issues --execution-id <id>`
**Agent needs more context?** → Use `scoutqa send-message` (see "Following Up on Stuck Executions")

## Writing Effective Prompts

Focus on **what to explore and verify**, not prescriptive steps. ScoutQA autonomously determines how to test.

**Example: User registration flow**

```bash
scoutqa --url "https://example.com" --prompt "
Explore the user registration flow. Test form validation edge cases,
verify error handling, and check accessibility compliance.
"
```

**Example: E-commerce checkout**

```bash
scoutqa --url "https://shop.example.com" --prompt "
Test the checkout flow. Verify pricing calculations, cart persistence,
payment options, and mobile responsiveness.
"
```

**Example: Running parallel tests for comprehensive coverage**

Launch multiple tests in parallel by making multiple Bash tool calls in a single message, each with the Bash tool's `timeout` parameter set to `5000` (milliseconds):

```bash
# Test 1: Authentication & security
scoutqa --url "https://app.example.com" --prompt "
Explore authentication: login/logout, session handling, password reset,
and security edge cases.
"

# Test 2: Core features (runs in parallel)
scoutqa --url "https://app.example.com" --prompt "
Test dashboard and main user workflows. Verify data loading,
CRUD operations, and search functionality.
"

# Test 3: Accessibility (runs in parallel)
scoutqa --url "https://app.example.com" --prompt "
Conduct accessibility audit: WCAG compliance, keyboard navigation,
screen reader support, color contrast.
"
```

**Key guidelines:**

- Describe **what to test**, not **how to test** (ScoutQA figures out the steps)
- Focus on goals, edge cases, and concerns
- Run multiple parallel executions for different test areas
- Trust ScoutQA to autonomously explore and discover issues
- Always set the Bash tool's `timeout` parameter to `5000` milliseconds when calling scoutqa commands
- For parallel tests, make multiple Bash tool calls in a single message

## Presenting Results

### Final Results (After Completion)

```markdown
**ScoutQA Test Results**

Execution ID: `ex_abc123`

**Issues Found:**

[High] Accessibility: Missing alt text on logo image

- Impact: Screen readers cannot describe the logo
- Location: Header navigation

[Medium] Usability: Submit button not visible on mobile viewport

- Impact: Users cannot complete form on mobile devices
- Location: Contact form, bottom of page
```

## Troubleshooting

| Issue                          | Solution                                                    |
| ------------------------------ | ----------------------------------------------------------- |
| `command not found: scoutqa`   | Install CLI: `npm i -g @scoutqa/cli@latest`                 |
| Auth expired / unauthorized    | Run `scoutqa auth login`                                    |
| Test hangs or needs input      | Use `scoutqa send-message --execution-id`                   |
| Check test results             | Visit browser URL or `scoutqa get-execution --execution-id` |
| Need issue ID for verification | Run `scoutqa list-issues --execution-id <id>`               |
