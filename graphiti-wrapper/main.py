"""
Minimal FastAPI wrapper for graphiti-core
Exposes native graphiti-core API for Next.js client
"""
import logging
from datetime import datetime
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from graphiti_core import Graphiti
from graphiti_core.edges import EntityEdge
from graphiti_core.nodes import EpisodeType
from graphiti_core.errors import NodeNotFoundError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ============================================================================
# Configuration
# ============================================================================

class Settings(BaseSettings):
    openai_api_key: str
    openai_base_url: str | None = None
    model_name: str | None = None
    neo4j_uri: str
    neo4j_user: str
    neo4j_password: str

    model_config = SettingsConfigDict(env_file='.env', extra='ignore')


def get_settings():
    return Settings()


# ============================================================================
# DTOs (Data Transfer Objects)
# ============================================================================

class EpisodeRequest(BaseModel):
    name: str
    episode_body: str
    source_description: str
    reference_time: str  # ISO 8601
    group_id: str


class EpisodeResponse(BaseModel):
    episode_id: str
    entities_created: int = 0
    relations_created: int = 0


class SearchResult(BaseModel):
    edges: list[dict]
    nodes: list[dict] = []


class HealthResponse(BaseModel):
    status: str
    version: str = "1.0.0"


# ============================================================================
# Graphiti Dependency
# ============================================================================

async def get_graphiti(settings: Annotated[Settings, Depends(get_settings)]):
    """Create and yield Graphiti client"""
    client = Graphiti(
        uri=settings.neo4j_uri,
        user=settings.neo4j_user,
        password=settings.neo4j_password,
    )

    # Configure LLM client if custom settings provided
    if settings.openai_base_url:
        client.llm_client.config.base_url = settings.openai_base_url
    if settings.openai_api_key:
        client.llm_client.config.api_key = settings.openai_api_key
    if settings.model_name:
        client.llm_client.model = settings.model_name

    try:
        yield client
    finally:
        await client.close()


GraphitiDep = Annotated[Graphiti, Depends(get_graphiti)]


# ============================================================================
# FastAPI App
# ============================================================================

app = FastAPI(title="Graphiti Wrapper API", version="1.0.0")


@app.get('/health')
async def health() -> HealthResponse:
    """Health check endpoint"""
    return HealthResponse(status="healthy")


@app.post('/episodes')
async def add_episode(
    request: EpisodeRequest,
    graphiti: GraphitiDep
) -> EpisodeResponse:
    """Add an episode to the knowledge graph"""
    try:
        # Parse ISO 8601 timestamp
        reference_time = datetime.fromisoformat(request.reference_time.replace('Z', '+00:00'))

        # Add episode using graphiti-core's native API
        result = await graphiti.add_episode(
            name=request.name,
            episode_body=request.episode_body,
            source_description=request.source_description,
            reference_time=reference_time,
            group_id=request.group_id,
            source=EpisodeType.text,  # Default to text type
        )

        logger.info(f"Added episode: {request.name} for group {request.group_id}")

        # Return response matching client expectations
        return EpisodeResponse(
            episode_id=result.uuid if hasattr(result, 'uuid') else str(result),
            entities_created=0,  # graphiti-core doesn't return this
            relations_created=0,  # graphiti-core doesn't return this
        )
    except Exception as e:
        logger.error(f"Error adding episode: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/search')
async def search(
    query: str,
    group_ids: str,  # Comma-separated
    graphiti: GraphitiDep,
    num_results: int = 10
) -> SearchResult:
    """Search the knowledge graph"""
    try:
        # Parse comma-separated group_ids
        group_id_list = [gid.strip() for gid in group_ids.split(',') if gid.strip()]

        # Search using graphiti-core's native API
        edges = await graphiti.search(
            query=query,
            group_ids=group_id_list,
            num_results=num_results,
        )

        logger.info(f"Search query: {query} | Found {len(edges)} edges")

        # Convert EntityEdge objects to dicts
        edge_dicts = []
        for edge in edges:
            edge_dict = {
                'uuid': edge.uuid,
                'name': edge.name,
                'fact': edge.fact,
                'created_at': edge.created_at.isoformat() if edge.created_at else None,
                'expired_at': edge.expired_at.isoformat() if edge.expired_at else None,
            }

            # Add source and target nodes
            if hasattr(edge, 'source_node') and edge.source_node:
                edge_dict['source_node'] = {
                    'name': edge.source_node.name if hasattr(edge.source_node, 'name') else '',
                    'uuid': edge.source_node.uuid if hasattr(edge.source_node, 'uuid') else '',
                }

            if hasattr(edge, 'target_node') and edge.target_node:
                edge_dict['target_node'] = {
                    'name': edge.target_node.name if hasattr(edge.target_node, 'name') else '',
                    'uuid': edge.target_node.uuid if hasattr(edge.target_node, 'uuid') else '',
                }

            # Get source_description from episode if edge has episode references
            if hasattr(edge, 'episodes') and edge.episodes:
                try:
                    episode_uuid = edge.episodes[0] if isinstance(edge.episodes, list) else edge.episodes
                    result = await graphiti.driver.execute_query(
                        "MATCH (e:Episodic {uuid: $uuid}) RETURN e.source_description as source_description",
                        uuid=str(episode_uuid)
                    )
                    if result.records and result.records[0]['source_description']:
                        edge_dict['source_description'] = result.records[0]['source_description']
                except Exception as e:
                    logger.warning(f"Could not get source_description for edge {edge.uuid}: {e}")

            # Add score if available
            if hasattr(edge, 'score'):
                edge_dict['score'] = edge.score

            edge_dicts.append(edge_dict)

        return SearchResult(edges=edge_dicts, nodes=[])
    except Exception as e:
        logger.error(f"Error searching: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete('/episodes/{episode_id}')
async def delete_episode(
    episode_id: str,
    graphiti: GraphitiDep
):
    """Delete an episode from the knowledge graph"""
    try:
        from graphiti_core.nodes import EpisodicNode

        # Get and delete the episodic node
        episode = await EpisodicNode.get_by_uuid(graphiti.driver, episode_id)
        await episode.delete(graphiti.driver)

        logger.info(f"Deleted episode: {episode_id}")
        return {"message": "Episode deleted", "success": True}
    except NodeNotFoundError:
        raise HTTPException(status_code=404, detail=f"Episode {episode_id} not found")
    except Exception as e:
        logger.error(f"Error deleting episode: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/entities/{entity_name}/edges')
async def get_entity_edges(
    entity_name: str,
    group_ids: str,  # Comma-separated
    graphiti: GraphitiDep
) -> SearchResult:
    """Get edges for a specific entity"""
    try:
        # Parse comma-separated group_ids
        group_id_list = [gid.strip() for gid in group_ids.split(',') if gid.strip()]

        # Search for the entity by name
        edges = await graphiti.search(
            query=entity_name,
            group_ids=group_id_list,
            num_results=50,  # Get more results for entity-specific queries
        )

        # Filter edges that contain the entity name
        filtered_edges = [
            edge for edge in edges
            if entity_name.lower() in edge.name.lower()
        ]

        logger.info(f"Entity edges for {entity_name}: Found {len(filtered_edges)} edges")

        # Convert to dicts (same as search endpoint)
        edge_dicts = []
        for edge in filtered_edges:
            edge_dict = {
                'uuid': edge.uuid,
                'name': edge.name,
                'fact': edge.fact,
                'created_at': edge.created_at.isoformat() if edge.created_at else None,
                'expired_at': edge.expired_at.isoformat() if edge.expired_at else None,
            }

            # Add source and target nodes
            if hasattr(edge, 'source_node') and edge.source_node:
                edge_dict['source_node'] = {
                    'name': edge.source_node.name if hasattr(edge.source_node, 'name') else '',
                    'uuid': edge.source_node.uuid if hasattr(edge.source_node, 'uuid') else '',
                }

            if hasattr(edge, 'target_node') and edge.target_node:
                edge_dict['target_node'] = {
                    'name': edge.target_node.name if hasattr(edge.target_node, 'name') else '',
                    'uuid': edge.target_node.uuid if hasattr(edge.target_node, 'uuid') else '',
                }

            # Get source_description from episode if edge has episode references
            if hasattr(edge, 'episodes') and edge.episodes:
                try:
                    episode_uuid = edge.episodes[0] if isinstance(edge.episodes, list) else edge.episodes
                    result = await graphiti.driver.execute_query(
                        "MATCH (e:Episodic {uuid: $uuid}) RETURN e.source_description as source_description",
                        uuid=str(episode_uuid)
                    )
                    if result.records and result.records[0]['source_description']:
                        edge_dict['source_description'] = result.records[0]['source_description']
                except Exception as e:
                    logger.warning(f"Could not get source_description for edge {edge.uuid}: {e}")

            # Add score if available
            if hasattr(edge, 'score'):
                edge_dict['score'] = edge.score

            edge_dicts.append(edge_dict)

        return SearchResult(edges=edge_dicts, nodes=[])
    except Exception as e:
        logger.error(f"Error getting entity edges: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
