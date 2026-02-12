# CLAUDE.md

## Tool Preferences

**Always prefer Serena MCP tools** for file and code operations unless there's a compelling reason not to:

- **Reading files**: Use `mcp__plugin_serena_serena__read_file` instead of the `Read` tool
- **Writing files**: Use `mcp__plugin_serena_serena__create_text_file` instead of `Write`
- **Editing files**: Use `mcp__plugin_serena_serena__replace_content` or symbol-based editing tools (`replace_symbol_body`, `insert_after_symbol`, `insert_before_symbol`) instead of `Edit`
- **Directory listing**: Use `mcp__plugin_serena_serena__list_dir` instead of `Bash` with `ls`
- **Finding files**: Use `mcp__plugin_serena_serena__find_file` instead of `Glob`
- **Searching code**: Use `mcp__plugin_serena_serena__search_for_pattern` instead of `Grep`
- **Understanding code structure**: Use `mcp__plugin_serena_serena__get_symbols_overview` and `mcp__plugin_serena_serena__find_symbol`

Serena's symbolic tools provide semantic understanding of code structure, making edits more precise and less error-prone.
