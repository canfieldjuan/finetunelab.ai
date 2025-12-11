
import asyncio
import os
from datetime import datetime
from graphiti_core import Graphiti
from graphiti_core.nodes import EpisodeType
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv(dotenv_path='.env.local')

# --- Your Data Goes Here ---
# Structure your data as a list of dictionaries. Each dictionary represents an "episode"
# to be loaded into the knowledge graph.
#
# Recommended structure:
# {
#     "name": "Title or summary of the data point",
#     "body": "The full text content of the data (the 'how-to', 'fact', or 'procedure').",
#     "episode_type": EpisodeType.DOCUMENT,  # Or other types like MESSAGE, CODE, etc.
#     "created_at": datetime, # The date the information was created or became valid.
#     "metadata": {
#         "category": "e.g., 'workflow', 'fact', 'how-to'",
#         "department": "e.g., 'Engineering', 'HR'",
#         "source_url": "Optional: URL to the original document",
#         "version": "Optional: version number"
#     }
# }

company_data = [
    {
        "name": "How to set up a new developer environment",
        "body": "\n        1. Install Python 3.10+.
        2. Clone the main repository from GitHub.
        3. Create a virtual environment: python -m venv venv
        4. Activate the virtual environment: source venv/bin/activate
        5. Install dependencies: pip install -r requirements.txt
        6. Set up the .env file by copying .env.example.
        7. Run the database migrations.
        ",
        "episode_type": EpisodeType.DOCUMENT,
        "created_at": datetime(2023, 1, 15),
        "metadata": {
            "category": "how-to",
            "department": "Engineering",
            "author": "jane.doe@example.com",
        },
    },
    {
        "name": "Company policy on remote work",
        "body": "All employees are eligible for remote work, subject to manager approval. "
                "Employees must maintain a dedicated and safe workspace. "
                "Core working hours are 10 AM to 4 PM in their local timezone.",
        "episode_type": EpisodeType.DOCUMENT,
        "created_at": datetime(2022, 5, 20),
        "metadata": {
            "category": "policy",
            "department": "HR",
        },
    },
    {
        "name": "Fact: Official company founding date",
        "body": "The company was officially founded on October 26, 2021.",
        "episode_type": EpisodeType.DOCUMENT,
        "created_at": datetime(2021, 10, 26),
        "metadata": {
            "category": "fact",
            "department": "General",
        },
    },
    {
        "name": "Workflow for deploying a new model",
        "body": "\n        1.  Submit a pull request with the model code and training scripts.
        2.  The PR must be reviewed and approved by at least two members of the MLOps team.
        3.  After approval, merge the PR to the main branch.
        4.  This will trigger the automated training and deployment pipeline.
        5.  Monitor the deployment in the #deployments Slack channel.
        ",
        "episode_type": EpisodeType.DOCUMENT,
        "created_at": datetime(2023, 8, 1),
        "metadata": {
            "category": "workflow",
            "department": "MLOps",
            "source_url": "http://internal-wiki.example.com/mlops/deployment-workflow"
        },
    },
]


async def main():
    """
    Connects to Neo4j, and loads the defined company data into the graph.
    """
    # 1. Get Neo4j credentials from environment variables
    neo4j_uri = os.getenv("NEO4J_URI")
    neo4j_user = os.getenv("NEO4J_USER")
    neo4j_password = os.getenv("NEO4J_PASSWORD")

    if not all([neo4j_uri, neo4j_user, neo4j_password]):
        print("Error: NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD must be set in your .env.local file.")
        return

    # 2. Initialize Graphiti with the Neo4j connection
    print(f"Connecting to Neo4j at {neo4j_uri}...")
    graphiti = Graphiti(uri=neo4j_uri, user=neo4j_user, password=neo4j_password)

    # 3. Build indices and constraints (only needs to be run once)
    # This sets up the database schema for optimal querying.
    print("Building database indices and constraints (if not already present)...")
    await graphiti.build_indices_and_constraints()

    # 4. Add the data to the graph
    print(f"Adding {len(company_data)} episodes to the knowledge graph...")
    for item in company_data:
        print(f"  - Adding '{item['name']}'")
        await graphiti.add_episode(
            name=item["name"],
            body=item["body"],
            episode_type=item["episode_type"],
            created_at=item["created_at"],
            metadata=item["metadata"]
        )

    print("\nData loading complete!")
    print("You can now query your knowledge graph.")

    # 5. Close the connection
    await graphiti.close()


if __name__ == "__main__":
    # To run this script, you need to install the required libraries:
    # pip install graphiti-core[neo4j] python-dotenv
    asyncio.run(main())
