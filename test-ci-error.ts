// This file intentionally contains a TypeScript error to test CI/CD gates

// Type error: assigning number to string
const testString: string = 123;

// Another type error: calling method that doesn't exist
const testArray: string[] = ['a', 'b', 'c'];
testArray.nonExistentMethod();

// This should cause TypeScript compilation to fail
export const brokenFunction = (): void => {
  const x: number = "this is not a number";
};
