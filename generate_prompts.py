import json

def create_generation_prompt(component_data):
    """
    Creates a prompt to be used with a powerful LLM to generate high-density training examples.
    """
    try:
        # Extract the user query and the assistant's factual response
        user_query = component_data['conversations'][0]['value']
        assistant_facts = component_data['conversations'][1]['value']

        # Extract the component name from the original query
        component_name = user_query.replace("What are the specs of the", "").replace("Tell me about the", "").replace("Should I get the", "").strip()

        prompt = f"""
You are a data generator for training an expert AI assistant for PC building.
Your task is to generate 3 high-density, conversational training examples based on the provided facts about a PC component.

**Factual Data for: {component_name}**
---
{assistant_facts}
---

**Instructions:**
Generate 3 new, distinct instruction-response pairs. Each pair should be in a JSON format with "from": "user" and "from": "assistant".

**Requirements for the new examples:**
1.  **Do NOT create simple fact-lookup questions.** The base model already knows the facts.
2.  **Focus on reasoning and comparison.** The user should be asking for advice, comparing the component to others, or asking about its suitability for a specific use case (e.g., gaming, video editing, budget builds).
3.  **The assistant's response should be expert-level.** It should explain the "why" behind its recommendations, mentioning trade-offs and providing context.
4.  **Be creative.** The user personas can vary (e.g., a first-time builder, an enthusiast on a budget, a professional video editor).

**Example of a GOOD generated pair:**
{{
  "from": "user",
  "value": "I'm thinking of upgrading my old CPU to the {component_name}. Is it still a good choice for 1080p gaming today, or should I save up for something more modern?"
}},
{{
  "from": "assistant",
  "value": "While the {component_name} was a solid performer in its day, you might find it bottlenecks modern GPUs in some CPU-intensive games at 1080p. For a significant upgrade on a budget, you might consider something like a Ryzen 5 5600, which would offer a substantial performance uplift and put you on a more modern platform with an upgrade path. However, if you can get the {component_name} for a very low price and are pairing it with a mid-range GPU, it could still offer a decent experience for now."
}}

**Now, generate 3 new high-density instruction-response pairs based on the provided factual data.**
"""
        return prompt

    except (KeyError, IndexError):
        return None

def main():
    try:
        with open("knowledge_training_1k.json", 'r') as f:
            data = json.load(f)

        # Create a file to save the prompts
        with open("generation_prompts.txt", 'w') as f:
            for i, component_data in enumerate(data):
                prompt = create_generation_prompt(component_data)
                if prompt:
                    f.write(f"--- Prompt for Component {i+1} ---\n")
                    f.write(prompt)
                    f.write("\n\n")
        
        print("Successfully generated prompts in 'generation_prompts.txt'.")
        print("\nNext Steps:")
        print("1. Open 'generation_prompts.txt'.")
        print("2. Copy each prompt and use it with a powerful LLM (like GPT-4, Claude 3, etc.) to get the generated data.")
        print("3. Collect the generated JSON examples and save them into a new file (e.g., 'high_density_dataset.jsonl').")
        print("4. **Crucially, review and curate the generated data** to ensure accuracy and quality before training.")


    except FileNotFoundError:
        print("Error: 'knowledge_training_1k.json' not found. Please make sure the file is in the same directory.")
    except json.JSONDecodeError:
        print("Error: Could not decode JSON from 'knowledge_training_1k.json'. Please check the file format.")

if __name__ == "__main__":
    main()