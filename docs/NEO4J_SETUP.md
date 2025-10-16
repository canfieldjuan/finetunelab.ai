# Neo4j Installation & Setup Guide

## ✅ Installation Complete

Neo4j is now running on your desktop via Docker.

## 📋 Connection Details

- **Browser UI**: <http://localhost:7474>
- **Bolt Connection**: bolt://localhost:7687
- **Username**: `neo4j`
- **Password**: `password123`

## 🚀 Quick Start

### 1. Access Neo4j Browser

Open <http://localhost:7474> in your browser and log in with:

- Username: `neo4j`
- Password: `password123`

### 2. Docker Commands

**Check if running:**

```bash
docker ps | grep neo4j
```

**View logs:**

```bash
docker logs neo4j-graphrag
```

**Stop Neo4j:**

```bash
docker stop neo4j-graphrag
```

**Start Neo4j:**

```bash
docker start neo4j-graphrag
```

**Restart Neo4j:**

```bash
docker restart neo4j-graphrag
```

**Remove Neo4j (keeps data):**

```bash
docker rm neo4j-graphrag
```

**Remove Neo4j and ALL data:**

```bash
docker rm -f neo4j-graphrag
docker volume rm neo4j_data neo4j_logs neo4j_import neo4j_plugins
```

## 📊 Installed Plugins

1. **APOC** - Awesome Procedures on Cypher (utility functions)
2. **Graph Data Science** - Advanced graph algorithms

## 🔧 Environment Variables (Already Configured)

Your `.env` file now includes:

```env
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=password123
GRAPHITI_BASE_URL=http://localhost:8001
```

## 🎯 Next Steps

1. **Start Graphiti Service** (if not running):

   ```bash
   cd /path/to/graphiti
   docker-compose up -d
   ```

   OR if using Python directly:

   ```bash
   python -m graphiti.server --port 8001
   ```

2. **Start your Next.js app**:

   ```bash
   cd web-ui
   npm run dev
   ```

3. **Test GraphRAG**:
   - Go to <http://localhost:3003/graphrag-demo>
   - Upload a document
   - Watch it build the knowledge graph!

## 🧪 Test Neo4j Connection

Run this Cypher query in the Neo4j Browser:

```cypher
RETURN "Neo4j is working!" as message
```

## 📦 Data Persistence

Your Neo4j data is stored in Docker volumes:

- `neo4j_data` - Database files
- `neo4j_logs` - Log files  
- `neo4j_import` - Import directory
- `neo4j_plugins` - Plugin files

These volumes persist even if you remove the container, so your data is safe!

## 🛠️ Troubleshooting

### Port Already in Use

If ports 7474 or 7687 are already in use:

```bash
# Find what's using the port
sudo lsof -i :7474
sudo lsof -i :7687

# Kill the process or change Neo4j ports
docker run -d \
  --name neo4j-graphrag \
  -p 7475:7474 \
  -p 7688:7687 \
  ...
```

### Can't Connect to Neo4j

1. Check if container is running: `docker ps | grep neo4j`
2. Check logs: `docker logs neo4j-graphrag`
3. Restart: `docker restart neo4j-graphrag`
4. Wait 20-30 seconds for full startup

### Reset Password

```bash
docker exec -it neo4j-graphrag neo4j-admin dbms set-initial-password newpassword
docker restart neo4j-graphrag
```

## 🔗 Useful Resources

- [Neo4j Browser Guide](https://neo4j.com/docs/browser-manual/current/)
- [Cypher Query Language](https://neo4j.com/docs/cypher-manual/current/)
- [APOC Documentation](https://neo4j.com/labs/apoc/)
- [Graph Data Science](https://neo4j.com/docs/graph-data-science/current/)
