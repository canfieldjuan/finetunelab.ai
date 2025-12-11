# LLM-as-Judge Tool - Simple Conversational Approach
**Date**: November 29, 2025
**Approach**: Give analytics assistant an `evaluate_messages` tool
**Complexity**: LOW - Just add one tool definition

---

## The Simple Idea

The analytics assistant already has access to session data and tools like `calculator` and `evaluation_metrics`.

**Just add ONE more tool**: `evaluate_messages`

Then users can ask: *"Evaluate the quality of responses in session baseline-gpt4"*

The assistant:
1. Already knows how to query session data
2. Calls `evaluate_messages` tool with message IDs
3. Gets back quality scores
4. Tells user in plain English

**No UI changes needed!** Pure conversational interface.

---

## Example Conversations

### Example 1: Single Session Evaluation

```
User: "How good were the responses in session baseline-gpt4?"