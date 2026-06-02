import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 衣柜主题色：莫兰迪低饱和（对齐用户调研的"低饱和色彩"偏好）
        brand: {
          50: "#faf7f4",
          100: "#f0e9e1",
          200: "#e0d2c2",
          300: "#c9b39c",
          400: "#a98b6e",
          500: "#876a4f",
          600: "#6a523c",
          700: "#523f2e",
          800: "#3a2c20",
          900: "#1f1810",
        },
        // 强调色: 雾粉, 跟莫兰迪暖咖搭配
        accent: {
          50: "#fdf6f6",
          100: "#f9e6e6",
          200: "#f0c8c8",
          300: "#e3a4a4",
          400: "#d27c7c",
          500: "#b95757",
          600: "#9a4040",
          700: "#7a3030",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "PingFang SC",
          "Noto Sans SC",
          "Microsoft YaHei",
          "Helvetica Neue",
          "sans-serif",
        ],
      },
      boxShadow: {
        soft: "0 8px 24px rgba(82, 63, 46, 0.08)",
        card: "0 2px 10px rgba(82, 63, 46, 0.06)",
        "card-hover": "0 12px 28px rgba(82, 63, 46, 0.14)",
      },
      borderRadius: {
        xl2: "1rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
