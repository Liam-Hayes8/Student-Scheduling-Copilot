#!/bin/bash

echo "🚀 Setting up Student Scheduling Copilot development environment..."

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if required environment variables are set
if [ ! -f .env ]; then
    echo "📝 Creating environment file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your actual API keys and configuration"
fi

# Start database services
echo "🐘 Starting database services..."
docker-compose up -d postgres redis

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker-compose exec postgres pg_isready -U postgres; do
    sleep 2
done

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install frontend dependencies
echo "🎨 Installing frontend dependencies..."
cd frontend && npm install && cd ..

# Install API dependencies
echo "🔧 Installing API dependencies..."
cd api && npm install && cd ..

# Run database migrations
echo "🗄️  Running database migrations..."
cd api && npx prisma migrate dev --name init && cd ..

# Generate Prisma client
echo "🔄 Generating Prisma client..."
cd api && npx prisma generate && cd ..

echo "✅ Development environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Run 'npm run dev' to start both frontend and backend"
echo "3. Visit http://localhost:3000 to use the application"
echo ""
echo "Useful commands:"
echo "- npm run dev: Start development servers"
echo "- npm run docker:up: Start all services with Docker"
echo "- npm run db:studio: Open Prisma Studio"
echo "- npm run lint: Run linting"
echo "- npm run typecheck: Run type checking"