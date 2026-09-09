# Mobile App Request Page Documentation

## Overview
The `CreateRequestScreen` component (`mobile/screens/CreateRequestScreen.js`) is responsible for handling the creation of new purchase requests within the mobile application. It allows users to fill in request details, add existing items from the inventory, or create new items directly from the screen. It also features robust offline submission support.

## Key Features
- **Project Selection**: Users can select a site or project name from horizontally scrollable options.
- **Request Details**: Includes input fields for:
  - **Purpose**: A required text area to specify the reason for the request.
  - **Date Needed**: A date picker (via `@react-native-community/datetimepicker`) to select when the items are required.
  - **Payment Basis**: A toggle between "Debt / Account" and "Cash / Non-Debt".
  - **Remarks**: An optional field for additional notes.
- **Item Management**: 
  - Allows adding items to the request from an existing inventory list via a search modal.
  - Users can easily increment, decrement, or remove item quantities.
- **Create New Item**: If an item is missing from the database, users can create one on the fly. This includes setting the item name, selecting a category, and optionally uploading an image from the device's library (via `expo-image-picker`).
- **Offline Support**: If the device has no internet connection (checked via `@react-native-community/netinfo`), the request is saved locally using `offlineSync.js`. It will automatically sync once the connection is restored. This fallback is also triggered on network timeouts/errors.

## API Endpoints Integrated
The screen interacts with the following backend endpoints through the `api` service:
- `GET /projects`: Fetches the list of available projects for selection.
- `GET /categories`: Retrieves item categories for the "Create New Item" modal.
- `GET /items`: Fetches the available inventory items to populate the search list.
- `POST /uploads`: Handles image uploads when creating a new item using a multipart form-data request.
- `POST /items`: Submits the data to create a new inventory item.
- `POST /purchase-requests`: Submits the finalized purchase request containing the details and the array of items.

## State Management
- Maintains local state for the form fields (`purpose`, `remarks`, `project`, `dateNeeded`, `paymentBasis`).
- Manages an `items` array storing the items requested along with their selected quantities.
- Modals state (`searchModalVisible`, `createModalVisible`) to control the visibility of the search and item creation overlays.
- Loading states (`loading`, `loadingItems`) to display visual feedback (like ActivityIndicators or disabled buttons) during network operations.

## Layout & Styling
- Utilizes a `KeyboardAvoidingView` to ensure input fields remain visible when the keyboard is active.
- Uses a `SafeAreaView` from `react-native-safe-area-context` to avoid notches and system UI elements.
- Implements a modern, clean UI with consistent color schemes (primarily `#FFBF00` for primary actions), rounded cards, and smooth modal overlays.
