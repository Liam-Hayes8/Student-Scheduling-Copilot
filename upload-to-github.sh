#!/bin/bash

echo "🚀 Student Scheduling Copilot - GitHub Upload Script"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "README.md" ] || [ ! -d "frontend" ] || [ ! -d "api" ]; then
    echo -e "${RED}❌ Error: Please run this script from the Student-Scheduling-Copilot directory${NC}"
    exit 1
fi

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git is not installed. Please install Git and try again.${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Pre-upload checklist:${NC}"
echo "1. Make sure you have a GitHub account"
echo "2. Create a new repository named 'student-scheduling-copilot' on GitHub"
echo "3. Make it PUBLIC for portfolio visibility"
echo "4. Do NOT initialize with README, .gitignore, or license"
echo ""

read -p "Have you created the GitHub repository? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⏸️  Please create the repository first, then run this script again.${NC}"
    echo "Go to: https://github.com/new"
    exit 1
fi

# Get GitHub username
echo ""
read -p "Enter your GitHub username: " GITHUB_USERNAME

if [ -z "$GITHUB_USERNAME" ]; then
    echo -e "${RED}❌ GitHub username is required${NC}"
    exit 1
fi

echo -e "${BLUE}🔧 Setting up local repository...${NC}"

# Rename gitignore file if it exists
if [ -f "gitignore" ]; then
    mv gitignore .gitignore
    echo -e "${GREEN}✅ Renamed gitignore to .gitignore${NC}"
fi

# Initialize git if not already done
if [ ! -d ".git" ]; then
    git init
    echo -e "${GREEN}✅ Initialized Git repository${NC}"
else
    echo -e "${YELLOW}⚠️  Git repository already exists${NC}"
fi

# Add all files
echo -e "${BLUE}📦 Adding all files...${NC}"
git add .

# Create initial commit
echo -e "${BLUE}💾 Creating initial commit...${NC}"
git commit -m "Initial commit: Student Scheduling Copilot MVP

🏗️ Complete Enterprise Architecture:
- Next.js frontend with TypeScript and Google OAuth
- Node.js/Express backend with sophisticated APIs  
- PostgreSQL database with pgvector for audit trails
- Docker containerization for development
- Comprehensive documentation and deployment guides

🤖 AI-Powered Features:
- OpenAI function calling for natural language processing
- Intelligent fallbacks to rule-based parsing
- Conflict detection and resolution algorithms
- Confidence scoring and explanations

🔒 Enterprise-Grade Security:
- Google OAuth with minimal calendar.events scope
- Complete audit trails for compliance
- Input validation and error handling
- Type safety throughout the stack

📋 Demonstrated Capabilities:
✅ Natural language parsing ('Block 7–9pm Tu/Th for EE labs')
✅ AI-powered intent analysis with confidence scoring
✅ Google Calendar integration with conflict detection
✅ Sophisticated alternative ranking and suggestions
✅ Complete audit trail for enterprise compliance
✅ Responsive UI with real-time feedback
✅ Production-ready infrastructure with Docker
✅ Full TypeScript implementation
✅ Modular microservices architecture
✅ Professional documentation and setup guides

This project demonstrates enterprise software engineering skills,
sophisticated AI integration, and production-ready architecture
patterns specifically valuable for companies like Workday."

# Set up remote origin
echo -e "${BLUE}🔗 Connecting to GitHub...${NC}"
REPO_URL="https://github.com/$GITHUB_USERNAME/student-scheduling-copilot.git"
git remote add origin $REPO_URL

# Set main branch
git branch -M main

# Push to GitHub
echo -e "${BLUE}⬆️  Uploading to GitHub...${NC}"
if git push -u origin main; then
    echo -e "${GREEN}🎉 Successfully uploaded to GitHub!${NC}"
    echo ""
    echo -e "${GREEN}📍 Your repository is now available at:${NC}"
    echo -e "${BLUE}   https://github.com/$GITHUB_USERNAME/student-scheduling-copilot${NC}"
    echo ""
    echo -e "${YELLOW}🔧 Next steps:${NC}"
    echo "1. Add repository topics for discoverability:"
    echo "   nextjs, typescript, ai, scheduling, google-calendar, openai"
    echo "   postgresql, docker, natural-language-processing, enterprise-software"
    echo ""
    echo "2. Update repository description:"
    echo "   'Enterprise-grade scheduling assistant with AI-powered natural language processing'"
    echo ""
    echo "3. Consider deploying for a live demo:"
    echo "   - Frontend: Deploy to Vercel"
    echo "   - Backend: Deploy to Railway or Google Cloud Run"
    echo ""
    echo -e "${GREEN}✨ Perfect for your portfolio and job applications!${NC}"
else
    echo -e "${RED}❌ Failed to upload to GitHub${NC}"
    echo "This might be because:"
    echo "1. The repository doesn't exist or isn't empty"
    echo "2. You don't have permission to push"
    echo "3. Your GitHub credentials aren't set up"
    echo ""
    echo "Try these commands manually:"
    echo "git remote -v"
    echo "git push -u origin main"
fi