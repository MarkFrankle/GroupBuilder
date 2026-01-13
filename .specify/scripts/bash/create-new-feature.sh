#!/bin/bash
# create-new-feature.sh
# Creates a new feature branch and spec file structure for spec-kit workflow

set -e

# Parse arguments
JSON_OUTPUT=false
NUMBER=""
SHORT_NAME=""
DESCRIPTION=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        --number)
            NUMBER="$2"
            shift 2
            ;;
        --short-name)
            SHORT_NAME="$2"
            shift 2
            ;;
        *)
            DESCRIPTION="$1"
            shift
            ;;
    esac
done

# Validation
if [[ -z "$NUMBER" ]] || [[ -z "$SHORT_NAME" ]]; then
    echo "Error: --number and --short-name are required" >&2
    exit 1
fi

# Construct branch and spec paths
BRANCH_NAME="${NUMBER}-${SHORT_NAME}"
SPEC_DIR="docs/specs/${BRANCH_NAME}"
SPEC_FILE="${SPEC_DIR}/spec.md"

# Create git branch
git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"

# Create spec directory structure
mkdir -p "${SPEC_DIR}/checklists"

# Initialize spec file from template if it doesn't exist
if [[ ! -f "$SPEC_FILE" ]]; then
    if [[ -f ".specify/templates/spec-template.md" ]]; then
        cp ".specify/templates/spec-template.md" "$SPEC_FILE"
    else
        # Create minimal spec if template doesn't exist
        cat > "$SPEC_FILE" <<EOF
# Feature Specification: ${DESCRIPTION}

## Overview

[Feature overview goes here]

## User Scenarios

[User scenarios go here]

## Functional Requirements

[Requirements go here]

## Success Criteria

[Success criteria go here]

## Assumptions

[Assumptions go here]

## Open Questions

[Questions go here]
EOF
    fi
fi

# Output results
if [[ "$JSON_OUTPUT" == "true" ]]; then
    cat <<EOF
{
  "BRANCH_NAME": "${BRANCH_NAME}",
  "SPEC_FILE": "${SPEC_FILE}",
  "SPEC_DIR": "${SPEC_DIR}"
}
EOF
else
    echo "Created branch: ${BRANCH_NAME}"
    echo "Spec file: ${SPEC_FILE}"
fi
