export default {
  transform: {
    "^.+\\.(t|j)sx?$": ["babel-jest", { presets: ["@babel/preset-env", "@babel/preset-typescript"] }],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  testEnvironment: "node",
};
