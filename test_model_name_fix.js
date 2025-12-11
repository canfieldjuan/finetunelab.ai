// Test the regex fix
const testCases = [
  { input: "meta-llama--Llama-3.2-1B-Instruct", expected: "meta-llama/Llama-3.2-1B-Instruct" },
  { input: "microsoft--Phi-3-mini-4k-instruct", expected: "microsoft/Phi-3-mini-4k-instruct" },
  { input: "mistralai--Mistral-7B-v0.1", expected: "mistralai/Mistral-7B-v0.1" },
  { input: "HuggingFaceTB--SmolLM3-3B", expected: "HuggingFaceTB/SmolLM3-3B" },
];

// Old buggy pattern
const oldPattern = /^([^-]+)--(.+)$/;

// New fixed pattern
const newPattern = /^(.+?)--(.+)$/;

console.log("\n=== Testing OLD (BUGGY) Pattern ===");
testCases.forEach(test => {
  const match = test.input.match(oldPattern);
  if (match) {
    const [, author, model] = match;
    const result = `${author}/${model}`;
    const status = result === test.expected ? "✅ PASS" : "❌ FAIL";
    console.log(`${status}: "${test.input}" → "${result}" (expected: "${test.expected}")`);
  }
});

console.log("\n=== Testing NEW (FIXED) Pattern ===");
testCases.forEach(test => {
  const match = test.input.match(newPattern);
  if (match) {
    const [, author, model] = match;
    const result = `${author}/${model}`;
    const status = result === test.expected ? "✅ PASS" : "❌ FAIL";
    console.log(`${status}: "${test.input}" → "${result}" (expected: "${test.expected}")`);
  }
});

console.log("\n");
