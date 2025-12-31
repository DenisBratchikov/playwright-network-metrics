module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.spec.ts", "**/*.test.ts"],
  modulePathIgnorePatterns: [
    "<rootDir>/dist/",
    "<rootDir>/test/integration.spec.ts",
  ],
};
