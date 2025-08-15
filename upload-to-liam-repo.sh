#!/bin/bash

echo "🚀 Uploading Student Scheduling Copilot to Liam's GitHub Repository"
echo "================================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Your specific repository details
GITHUB_USERNAME="Liam-Hayes8"
REPO_NAME="Student-Scheduling-Copilot"
REPO_URL="https://github.com/$GITHUB_USERNAME/$REPO_NAME.git"

echo -e "${BLUE}📍 Target Repository: $REPO_URL${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "README.md" ] || [ ! -d "frontend" ] || [ ! -d "api" ]; then
    echo -e "${RED}❌ Error: Please run this script from the Student-Scheduling-Copilot directory${NC}"
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

# Configure git user (you can change these)
git config user.name "Liam Hayes"
git config user.email "liam.hayes8@example.com"

# Add all files
echo -e "${BLUE}📦 Adding all files...${NC}"
git add .

# Check if there are any changes to commit
if git diff --staged --quiet; then
    echo -e "${YELLOW}⚠️  No changes to commit${NC}"
else
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

Perfect for demonstrating enterprise software engineering skills,
sophisticated AI integration, and production-ready architecture
patterns specifically valuable for companies like Workday."
    echo -e "${GREEN}✅ Commit created${NC}"
fi

# Check if remote already exists
if git remote get-url origin &> /dev/null; then
    echo -e "${YELLOW}⚠️  Remote origin already exists, updating...${NC}"
    git remote set-url origin $REPO_URL
else
    echo -e "${BLUE}🔗 Adding remote origin...${NC}"
    git remote add origin $REPO_URL
fi

# Set main branch
git branch -M main

# Push to GitHub
echo -e "${BLUE}⬆️  Uploading to GitHub...${NC}"
echo -e "${YELLOW}📝 You may need to enter your GitHub credentials...${NC}"

if git push -u origin main; then
    echo ""
    echo -e "${GREEN}🎉 SUCCESS! Your Student Scheduling Copilot is now on GitHub!${NC}"
    echo ""
    echo -e "${GREEN}📍 Repository URL:${NC}"
    echo -e "${BLUE}   $REPO_URL${NC}"
    echo ""
    echo -e "${YELLOW}🔧 Recommended next steps:${NC}"
    echo "1. Add repository topics on GitHub:"
    echo "   nextjs, typescript, ai, scheduling, google-calendar, openai"
    echo "   postgresql, docker, natural-language-processing, enterprise-software"
    echo ""
    echo "2. Update repository description:"
    echo "   'Enterprise-grade scheduling assistant with AI-powered natural language processing'"
    echo ""
    echo "3. Consider deploying for a live demo:"
    echo "   - Frontend: Vercel (npm run build)"
    echo "   - Backend: Railway or Google Cloud Run"
    echo ""
    echo -e "${GREEN}✨ Perfect addition to your portfolio!${NC}"
    echo -e "${GREEN}✨ Ready for Workday applications!${NC}"
else
    echo ""
    echo -e "${RED}❌ Upload failed${NC}"
    echo -e "${YELLOW}This might be because:${NC}"
    echo "1. You need to authenticate with GitHub (enter username/password or token)"
    echo "2. The repository might not be empty"
    echo "3. Network connectivity issues"
    echo ""
    echo -e "${BLUE}You can also try these manual commands:${NC}"
    echo "git remote -v"
    echo "git push -u origin main"
    echo ""
    echo -e "${BLUE}Or upload manually through GitHub web interface:${NC}"
    echo "1. Zip all the files"
    echo "2. Go to your repository on GitHub"
    echo "3. Click 'uploading an existing file'"
    echo "4. Drag and drop the files"
fi

echo ""
echo -e "${BLUE}📊 Repository Statistics:${NC}"
echo "Lines of code: $(find . -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' | xargs wc -l | tail -1)"
echo "Files created: $(find . -type f | wc -l | xargs)"
echo "Technologies: Next.js, TypeScript, Node.js, Express, PostgreSQL, Docker, OpenAI"