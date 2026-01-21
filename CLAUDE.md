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

## Known Tool Issues

### Serena `replace_content` - `replace_all` Parameter Bug

**Issue:** The `replace_all: true` parameter does not work as documented. When a search expression matches multiple occurrences, the tool errors even with `replace_all: true`.

**Error Message (Misleading):**
```
ValueError - Expression matches N occurrences in file. Please revise the 
expression to be more specific or enable allow_multiple_occurrences if this is expected.
```

Note: The parameter is actually `replace_all`, not `allow_multiple_occurrences` as the error suggests.

**Workaround:**
Provide unique context for each replacement to make each occurrence unambiguous:

```python
# ❌ This will fail with multiple matches even with replace_all: true
mcp__plugin_serena_serena__replace_content(
    needle="datetime.utcnow()",
    repl="datetime.now(timezone.utc)",
    mode="regex",
    replace_all=true  # Does not work
)

# ✅ Instead, include surrounding context to make each occurrence unique
mcp__plugin_serena_serena__replace_content(
    needle='invite_ref.set({\n            "created_at": datetime.utcnow(),',
    repl='invite_ref.set({\n            "created_at": datetime.now(timezone.utc),',
    mode="literal"
)
```

**When Multiple Replacements Needed:**
- Make separate calls with unique context for each occurrence
- Include surrounding lines to make the match unambiguous
- Use literal mode when possible for clearer matching
