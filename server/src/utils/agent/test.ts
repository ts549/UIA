import { analyzeCodeWithAI } from './promptAgent.ts';

// Create a fake context string matching the prompTemplate.md format
const createTestContext = () => {
    const userPrompt = "Make this button change to blue color on hover";
    
    const mainElement = `<button 
        onClick={handleClick}
        className="submit-btn"
        >
        Submit
        </button>`;
    const mainElementId = "abc123def456";
    const mainElementFile = "src/components/Form.tsx";

    const parentElement = `<form onSubmit={handleSubmit}>
        <input type="text" />
        <button 
            onClick={handleClick}
            className="submit-btn"
        >
            Submit
        </button>
        </form>`;
    const parentElementId = "xyz789ghi012";
    const parentElementFile = "src/components/Form.tsx";

    const functionCalled = `const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        console.log('Button clicked');
        submitForm();
        }`;
    const functionId = "func123abc456";
    const functionFile = "src/components/Form.tsx";

    const propertyUsed = `className`;
    const propertyId = "prop456def789";
    const propertyFile = "src/components/Form.tsx";

    // Format according to prompTemplate.md
    const contextString = `User intent: ${userPrompt}

        Main element: ${mainElement}
        id: ${mainElementId}
        File: ${mainElementFile}

        Parent element: ${parentElement}
        id: ${parentElementId}
        File: ${parentElementFile}

        Calls: ${functionCalled}
        id: ${functionId}
        File: ${functionFile}

        Uses: ${propertyUsed}
        id: ${propertyId}
        File: ${propertyFile}`;

    return contextString;
};

// Run the test
async function runTest() {
    console.log('=== Testing OpenAI Prompt Agent ===\n');
    
    const testContext = createTestContext();
    
    console.log('Input Context:');
    console.log(testContext);
    console.log('\n--- Calling OpenAI API ---\n');
    
    try {
        const result = await analyzeCodeWithAI(testContext);
        
        console.log('✅ API Response:');
        console.log(JSON.stringify(result, null, 2));
        
        if (result.plan && Array.isArray(result.plan)) {
        console.log(`\n📋 Plan contains ${result.plan.length} modification(s)`);
        result.plan.forEach((item: any, index: number) => {
            console.log(`\n${index + 1}. ${item.action} in ${item.file}`);
            console.log(`   Reason: ${item.reason}`);
        });
        }
        
        if (result.confidence) {
        console.log(`\n🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Execute test
runTest();
