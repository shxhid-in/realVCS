# **App Name**: ButcherBot POS

## Core Features:

- Butcher Authentication: User authentication system for butchers to log in with their ID and password.
- Menu Management: Menu management tab for each butcher to list items with price per kg/nos, availability toggle, and submit button to update menu. Items include categories like chicken, mutton, beef, and various types of fish, as per the details provided. Supports entering price per kg and a dropdown for selecting weight or nos.
- Order Management: Order management tab to display incoming orders as cards, with accept and reject buttons. Accepted orders move to a preparing tab with a 20-minute timer. Rejected orders require a reason for rejection.
- Order Preparation: Prepared orders display in a prepared tab. Butchers enter the final weight of the product, then submit. All orders will have date, order ID, butcher ID, butcher name, item name, final weight, cut type and price information saved.
- Analytics Dashboard: Analytics tab to show total orders completed, total revenue, and average preparation time. Includes a list of orders processed that day with revenue and preparation time per order. All reports must automatically take the information from google sheets, in order to be displayed.
- Google Sheets Integration: Backend process to scrape order details from a Google Sheet using the provided API key and display them in the order management tab.
- Dark/Light Mode: Users can switch between light and dark mode.

## Style Guidelines:

- Primary color: White (#FFFFFF) for a clean, modern look.
- Accent color: Teal (#008080) for highlights and interactive elements.
- Background color: Light gray (#F0F0F0) for light mode, dark gray (#333333) for dark mode.
- Font: 'Inter', a grotesque-style sans-serif with a modern look, for both headlines and body text.
- Simple, clean icons for each tab and action, consistent with a modern design aesthetic.
- A tabbed interface for easy navigation between menu management, order management, analytics, and settings.
- Subtle transitions and animations to enhance user experience, such as loading indicators and feedback on button presses.