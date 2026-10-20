/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#283630',
          light: '#3E4F47',
          dark: '#1C2622',
        },
        sage: {
          DEFAULT: '#789184',
          hover: '#688074',
          tint: '#E8EEE9',
          light: '#F0F4F1',
          dark: '#586E63',
        },
        warm: {
          bg: '#F7F6F2',
          surface: '#FFFFFF',
          border: '#E2E4DE',
          slate: '#737C77',
          muted: '#EFEFEA',
        },
        civicred: {
          DEFAULT: '#C65353',
          hover: '#B34545',
          light: '#FAEDED',
          border: '#E8C1C1',
        },
        civicamber: {
          DEFAULT: '#B68A4D',
          hover: '#A3793D',
          light: '#FBF5ED',
          border: '#E6D2B8',
        },
        civicgreen: {
          DEFAULT: '#5E806B',
          hover: '#4F6F5B',
          light: '#EEF4F0',
          border: '#C6D8CD',
        }
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(40, 54, 48, 0.04)',
        sm: '0 1px 3px 0 rgba(40, 54, 48, 0.06), 0 1px 2px -1px rgba(40, 54, 48, 0.04)',
        md: '0 4px 6px -1px rgba(40, 54, 48, 0.07), 0 2px 4px -2px rgba(40, 54, 48, 0.05)',
      }
    },
  },
  plugins: [],
}
