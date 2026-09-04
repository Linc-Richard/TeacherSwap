module.exports = [
  {
    files: ["js/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        clearTimeout: "readonly",
        fetch: "readonly",
        URL: "readonly",
        FormData: "readonly",
        File: "readonly",
        EventSource: "readonly",
        confirm: "readonly",
        prompt: "readonly",
        alert: "readonly",
        btoa: "readonly",
        atob: "readonly",
        TextDecoder: "readonly",
        TextEncoder: "readonly",
        IntersectionObserver: "readonly",
        FileReader: "readonly",
        NodeFilter: "readonly",
        google: "readonly",
        googleAuth: "readonly",
        TS: "readonly",
        api: "readonly",
        API_BASE: "readonly",
        showToast: "readonly",
        __: "readonly",
        L: "readonly"
      }
    },
    rules: {
      "no-undef": "warn",
      "no-unused-vars": ["warn", { "args": "none" }],
      "no-redeclare": ["error", { "builtinGlobals": false }],
      "eqeqeq": "warn",
      "no-eval": "error"
    }
  }
];
