"use strict";

// Simple safe math evaluator — no eval(), no dependencies
function safeMath(expr) {
  // Only allow digits, operators, spaces, dots, parens
  if (!/^[\d\s+\-*/^().%]+$/.test(expr)) throw new Error("Invalid characters in expression");

  // Replace ^ with ** for exponentiation
  const clean = expr.replace(/\^/g, "**");

  // Use Function constructor scoped to nothing — no access to globals
  const result = new Function(`"use strict"; return (${clean})`)();
  if (!isFinite(result)) throw new Error("Result is not finite");
  return result;
}

module.exports = {
  config: {
    name:      "calc",
    aliases:   ["math", "calculate"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      0,
    category:  "utility",
    countDown: 2,
    description: { en: "Evaluate a math expression" },
    guide:       { en: "{pn} <expression> — e.g. {pn} (5+3)*2^3" },
  },

  langs: {
    en: {
      noExpr:  "❌ Please provide an expression. Example: `/calc 5+3*2`",
      result:  "🧮 *Calculator*\n📥 Input: `%1`\n📤 Result: `%2`",
      error:   "❌ Invalid expression: %1",
    },
  },

  onStart: async function ({ message, args, getLang }) {
    const expr = args.join(" ").trim();
    if (!expr) return message.reply(getLang("noExpr"));

    try {
      const result = safeMath(expr);
      const pretty = Number.isInteger(result)
        ? result.toLocaleString()
        : result.toLocaleString(undefined, { maximumFractionDigits: 10 });

      return message.reply(
        getLang("result").replace("%1", expr).replace("%2", pretty)
      );
    } catch (e) {
      return message.reply(getLang("error").replace("%1", e.message));
    }
  },
};
