import { PlannerService } from '../modules/planner';
import { LLMOrchestratorService } from '../modules/llm';

async function testPlannerService() {
  console.log('🧪 Testing Planner Service...');
  
  const planner = new PlannerService();
  
  const testRequests = [
    'Block 7–9pm Tu/Th for EE labs',
    'Study sessions 3 hours per week, prefer mornings',
    'Weekly team meeting on Mondays at 2pm',
    'Gym time 1 hour daily, avoid Fridays'
  ];

  for (const request of testRequests) {
    console.log(`\n📝 Request: "${request}"`);
    
    try {
      const plans = await planner.createEventPlan({
        userId: 'test-user',
        naturalLanguageInput: request
      });
      
      console.log(`✅ Generated ${plans.length} plan(s):`);
      plans.forEach((plan, i) => {
        console.log(`  ${i + 1}. ${plan.title} - ${new Date(plan.startDateTime).toLocaleString()} to ${new Date(plan.endDateTime).toLocaleString()}`);
        console.log(`     Confidence: ${Math.round(plan.confidence * 100)}%`);
        console.log(`     Explanation: ${plan.explanation}`);
      });
    } catch (error) {
      console.log(`❌ Error: ${error}`);
    }
  }
}

async function testLLMService() {
  console.log('\n🤖 Testing LLM Orchestrator Service...');
  
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️  OpenAI API key not configured, skipping LLM tests');
    return;
  }
  
  const llm = new LLMOrchestratorService();
  
  const testRequest = {
    userId: 'test-user',
    naturalLanguageInput: 'Schedule study time 2 hours every Tuesday and Thursday evening, avoid late nights'
  };

  try {
    console.log(`\n📝 Request: "${testRequest.naturalLanguageInput}"`);
    
    const analysis = await llm.analyzeRequest(testRequest);
    console.log(`✅ LLM Analysis:`);
    console.log(`  Intent: ${analysis.intent}`);
    console.log(`  Confidence: ${Math.round(analysis.confidence * 100)}%`);
    console.log(`  Extracted Info:`, analysis.extractedInfo);
    
    if (analysis.clarificationNeeded?.length) {
      console.log(`  Questions:`, analysis.clarificationNeeded);
    }
    
    if (analysis.suggestions?.length) {
      console.log(`  Suggestions:`, analysis.suggestions);
    }
    
    if (analysis.intent === 'SCHEDULE_EVENT' && analysis.confidence > 0.6) {
      const plans = await llm.generateEventPlan(analysis.extractedInfo, testRequest.naturalLanguageInput);
      console.log(`✅ Generated ${plans.length} enhanced plan(s):`);
      plans.forEach((plan, i) => {
        console.log(`  ${i + 1}. ${plan.title} - ${new Date(plan.startDateTime).toLocaleString()}`);
      });
    }
  } catch (error) {
    console.log(`❌ LLM Error: ${error}`);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  (async () => {
    await testPlannerService();
    await testLLMService();
    console.log('\n🎉 Testing complete!');
  })();
}

export { testPlannerService, testLLMService };