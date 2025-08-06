/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/**/*.{js,ts,jsx,tsx,mdx}', // Add this line
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Yekan Bakh', 'Yekan', 'Bakh'], // or your preferred font

            },
        },
    },
    plugins: [],
    corePlugins: {
        // Ensure all core plugins are enabled
        preflight: true,
    }
}